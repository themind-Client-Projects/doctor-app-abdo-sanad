'use client';

import Image from 'next/image';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { Product } from '@/lib/constants/demo-data';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addToCart, removeFromCart, updateQuantity } = useCartStore();
  
  const cartItem = items.find(item => item.id === product.id);
  const quantity = cartItem?.quantity || 0;

  return (
    <div className="bg-white rounded-3xl p-3 shadow-sm border border-gray-100 flex flex-col h-full group hover:shadow-md transition-shadow">
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-3 flex-shrink-0">
        <Image 
          src={product.image} 
          alt={product.name} 
          fill 
          className="object-cover group-hover:scale-105 transition-transform duration-500" 
        />
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg">نفذت الكمية</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col">
        <span className="text-[10px] font-bold text-primary mb-1">{product.category}</span>
        <h3 className="font-extrabold text-sm text-gray-900 mb-2 line-clamp-2 leading-tight">{product.name}</h3>
        
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-extrabold text-gray-900">{product.price.toLocaleString('ar-IQ')} <span className="text-[10px] text-gray-500 font-normal">د.ع</span></span>
          
          {quantity > 0 ? (
            <div className="flex items-center gap-2 bg-primary/5 rounded-xl border border-primary/20 p-1">
              <button 
                onClick={() => updateQuantity(product.id, quantity - 1)}
                className="w-6 h-6 flex items-center justify-center bg-white text-primary rounded-lg shadow-sm hover:bg-primary hover:text-white transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-bold text-primary min-w-[1ch] text-center">{quantity}</span>
              <button 
                onClick={() => updateQuantity(product.id, quantity + 1)}
                className="w-6 h-6 flex items-center justify-center bg-white text-primary rounded-lg shadow-sm hover:bg-primary hover:text-white transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button 
              disabled={!product.inStock}
              onClick={() => addToCart(product)}
              className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
