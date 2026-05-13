'use client';

import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, Receipt, Clock, TrendingUp } from 'lucide-react';
import { PageBackButton } from '@/components/shared/page-back-button';

interface Transaction {
  id: number;
  title: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  date: string;
}

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 1, title: 'استرداد حجز ملغي', description: 'د. سمير محمود', amount: '+15,000', type: 'credit', date: '12 مايو 2026' },
  { id: 2, title: 'دفع رسوم كشف', description: 'د. نور الهدى - علاج طبيعي', amount: '-25,000', type: 'debit', date: '10 مايو 2026' },
  { id: 3, title: 'إيداع رصيد', description: 'بطاقة ائتمان ****4567', amount: '+50,000', type: 'credit', date: '8 مايو 2026' },
  { id: 4, title: 'دفع رسوم تحاليل', description: 'مختبرات الشفاء - فحص شامل', amount: '-85,000', type: 'debit', date: '5 مايو 2026' },
  { id: 5, title: 'مكافأة إحالة صديق', description: 'تمت الإحالة بنجاح', amount: '+10,000', type: 'credit', date: '1 مايو 2026' },
];

export default function WalletPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 px-4 pt-14 pb-10 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/4" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl translate-y-1/2 translate-x-1/4" />
        <PageBackButton />
        <div className="relative z-10 text-center mt-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">محفظتي</h1>
          <p className="text-primary-foreground/70 text-sm mt-1 font-medium">إدارة رصيدك ومعاملاتك</p>
        </div>
      </header>

      {/* Balance Card */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">الرصيد الحالي</p>
                <h2 className="text-2xl font-extrabold text-gray-800">1,250 <span className="text-base font-bold text-gray-500">د.ع</span></h2>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-bold">
              <TrendingUp className="w-3 h-3" />
              نشط
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <button className="w-full bg-primary text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-md shadow-primary/20">
              <Plus className="w-4 h-4" />
              إيداع رصيد
            </button>
          </div>
        </div>
      </div>

      <main className="px-4 mt-6 space-y-6">
        {/* Stats Row */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">إجمالي الإيداعات</span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-800">75,000 <span className="text-xs text-gray-400 font-bold">د.ع</span></h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">إجمالي المصروفات</span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-800">110,000 <span className="text-xs text-gray-400 font-bold">د.ع</span></h3>
          </div>
        </section>

        {/* Transactions */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              آخر المعاملات
            </h3>
            <button className="text-sm text-primary font-bold hover:text-primary/70 transition-colors">
              عرض الكل
            </button>
          </div>

          <div className="space-y-3">
            {DEMO_TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 hover:border-primary/20 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'credit' ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  {tx.type === 'credit'
                    ? <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    : <ArrowUpRight className="w-5 h-5 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-sm truncate">{tx.title}</h4>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{tx.description}</p>
                </div>
                <div className="text-end flex-shrink-0">
                  <p className={`text-sm font-extrabold ${
                    tx.type === 'credit' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {tx.amount} د.ع
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {tx.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
