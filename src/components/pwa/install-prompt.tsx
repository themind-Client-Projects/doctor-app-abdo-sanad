'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
      // Slight delay to allow smooth sliding animation
      const t = setTimeout(() => setIsVisible(true), 100);
      timersRef.current.push(t);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For testing/demo purposes: show prompt after 3 seconds if not in standalone mode
    // (Only if the browser doesn't support beforeinstallprompt natively, like iOS)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone) {
      const t1 = setTimeout(() => {
        setShowPrompt(true);
        const t2 = setTimeout(() => setIsVisible(true), 100);
        timersRef.current.push(t2);
      }, 3000);
      timersRef.current.push(t1);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
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
    await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setIsVisible(false);
    const t = setTimeout(() => setShowPrompt(false), 500);
    timersRef.current.push(t);
  };

  const handleClose = () => {
    setIsVisible(false);
    const t = setTimeout(() => setShowPrompt(false), 500);
    timersRef.current.push(t);
  };

  if (!showPrompt) return null;

  return (
    <div 
      className={`fixed bottom-24 left-4 right-4 z-50 transition-[transform,opacity] duration-500 ease-out transform ${
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
