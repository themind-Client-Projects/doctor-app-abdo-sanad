'use client';

import { ShoppingBag, X, Plus, Minus, Trash2, Package, Phone } from 'lucide-react';
import Image from 'next/image';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/ecommerce/cart.store';
import { formatNumber } from "@/lib/format";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pharmacy this basket belongs to — the only party that can fill it. */
  pharmacyName?: string;
  pharmacyPhone?: string | null;
}

export function CartDrawer({ open, onOpenChange, pharmacyName, pharmacyPhone }: CartDrawerProps) {
  const { items, updateQuantity, removeFromCart, getTotalPrice, getTotalItems, clearCart } = useCartStore();

  // NO CHECKOUT. This used to be a 1.5s `setTimeout` that flipped `success`
  // and told the patient «تم الطلب بنجاح! تم تجهيز طلبك وسيتم تحضيره من
  // الصيدلية» — for an order that was never created, never priced, never paid
  // and never sent to any pharmacy. The basket was then cleared, so nothing
  // remained to show that nothing had happened.
  //
  // An `Order` carries a `serviceType` and totals but has no line items —
  // there is no `OrderItem` model — so a basket of products cannot be
  // represented in the database at all. Placing one for real needs that
  // model plus the pricing, payment (Wayl) and prescription rules that go
  // with dispensing medicine, all of which are the client's to decide.
  //
  // Until then the basket is a list the patient builds and takes to the
  // pharmacy by phone, and it says exactly that.

  if (items.length === 0) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-md flex flex-col items-center justify-center py-20 px-5 text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag className="w-12 h-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">السلة فارغة</h3>
            <p className="text-sm text-gray-500 mb-8">لم تقم بإضافة أي منتجات إلى سلة المشتريات بعد.</p>
            <DrawerClose asChild>
              <Button className="w-full rounded-2xl py-6 font-bold">متابعة التسوق</Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] h-[92vh]">
        <div className="mx-auto w-full max-w-md flex flex-col h-full pb-safe">
          <DrawerHeader className="text-right px-5 border-b border-gray-100 pb-4">
            <div className="flex justify-between items-center">
              <DrawerClose asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </DrawerClose>
              <DrawerTitle className="text-xl font-extrabold flex items-center gap-2">
                سلة المشتريات
                <span className="bg-primary/10 text-primary text-sm px-2 py-0.5 rounded-full">{getTotalItems()}</span>
              </DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {items.map((item) => (
                <div key={item.id} className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
                  <div className="relative w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-7 h-7 text-gray-300" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block mb-1">{item.category}</span>
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.name}</h4>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-extrabold text-primary">{formatNumber(item.price)} <span className="text-[10px] font-normal">د.ع</span></span>
                      
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-100">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>

          <DrawerFooter className="border-t border-gray-100 px-5 py-4 bg-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 font-bold">المجموع التقديري</span>
              <span className="text-xl font-extrabold text-gray-900">{formatNumber(getTotalPrice())} <span className="text-sm font-normal text-gray-500">د.ع</span></span>
            </div>
            {/* Prices are the pharmacy's own catalogue prices; the total is
                what the basket adds up to, not a quote the pharmacy has
                confirmed. */}
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              الدفع الإلكتروني غير متاح بعد. تواصل مع {pharmacyName ?? 'الصيدلية'} لتأكيد التوفر والسعر النهائي وطريقة الاستلام.
            </p>
            {pharmacyPhone ? (
              // `Button` has no `asChild`, so the anchor carries the styling.
              <a
                href={`tel:${pharmacyPhone}`}
                className="w-full rounded-2xl py-4 font-bold text-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-95 transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" aria-hidden />
                اتصل بالصيدلية
              </a>
            ) : (
              <Button disabled className="w-full rounded-2xl py-6 font-bold text-lg">
                لا يوجد رقم تواصل للصيدلية
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={clearCart}
              className="w-full rounded-2xl font-bold text-gray-500"
            >
              إفراغ السلة
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
