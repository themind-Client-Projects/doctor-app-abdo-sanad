'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
      // Slight delay to allow smooth sliding animation
      setTimeout(() => setIsVisible(true), 100);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For testing/demo purposes: show prompt after 3 seconds if not in standalone mode
    // (Only if the browser doesn't support beforeinstallprompt natively, like iOS)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone) {
      setTimeout(() => {
        setShowPrompt(true);
        setTimeout(() => setIsVisible(true), 100);
      }, 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS
      alert('لتثبيت التطبيق، اضغط على زر المشاركة (Share) ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setIsVisible(false);
    setTimeout(() => setShowPrompt(false), 500);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setShowPrompt(false), 500);
  };

  if (!showPrompt) return null;

  return (
    <div 
      className={`fixed bottom-24 left-4 right-4 z-50 transition-all duration-500 ease-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-300/30 border border-gray-100 p-4 flex items-center justify-between gap-4 backdrop-blur-sm bg-white/95">
        <div className="flex-1 flex flex-col">
          <h4 className="text-sm font-extrabold text-gray-900 mb-0.5">تثبيت تطبيق سند</h4>
          <p className="text-xs text-gray-500 leading-tight">للحصول على تجربة أسرع وأفضل</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleInstallClick}
            className="bg-primary text-white text-[11px] sm:text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-primary/20"
          >
            <Download className="w-3.5 h-3.5" />
            تثبيت
          </button>
          
          <button 
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
