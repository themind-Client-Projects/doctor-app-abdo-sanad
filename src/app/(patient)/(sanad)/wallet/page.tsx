'use client';

import { useMemo, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, Receipt, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { formatNumber, formatRelative } from '@/lib/format';
import { FlexibleHeader } from '@/components/shared/flexible-header';

/**
 * محفظتي — the patient's real balance.
 *
 * Read from /api/v1/me/wallet. The page previously showed a fixed 1,250 د.ع
 * over five invented transactions, and the two stat tiles (75,000 / 110,000)
 * agreed with neither the balance nor the list.
 *
 * GLOBAL, not per-channel: one balance spendable inside سند and outside it.
 * Each movement carries its order's `source`, which is what keeps a single
 * wallet legible across both storefronts.
 */

type WalletTx = {
  id: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  reason: string;
  description: string | null;
  createdAt: string;
  order: { orderNumber: string; serviceType: string; source: string } | null;
};

type WalletData = { balance: number; transactions: WalletTx[] };

/** `reason` is the machine key; this is what the patient reads. */
const REASON_LABELS: Record<string, string> = {
  TOPUP: 'إيداع رصيد',
  PAYMENT: 'دفع رسوم خدمة',
  REFUND: 'استرداد مبلغ',
  REWARD: 'مكافأة',
};

export default function WalletPage() {
  const { data, isLoading, error, refetch } = useDashboardData<WalletData>({
    url: '/api/v1/me/wallet',
  });
  // Whether the gateway is configured at all — an "إيداع رصيد" button that
  // 503s is worse than one that is not shown.
  const { data: topup } = useDashboardData<{ available: boolean; minAmount: number }>({
    url: '/api/v1/me/wallet/topup',
  });

  const [amount, setAmount] = useState('');

  const { mutate: startTopup, isPending: starting } = useMutation(
    async () => {
      const res = await apiFetch<{ checkoutUrl: string | null }>('/api/v1/me/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
      });
      // Hand off to Wayl. The wallet is credited by their webhook, never here.
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      return res;
    },
    { successMessage: null, onSuccess: () => void refetch() }
  );

  const transactions = useMemo(() => data?.transactions ?? [], [data]);

  // Derived from the movements rather than hardcoded, so the tiles can never
  // disagree with the list beneath them.
  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const t of transactions) {
      if (t.type === 'CREDIT') credit += Number(t.amount);
      else debit += Number(t.amount);
    }
    return { credit, debit };
  }, [transactions]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* The only patient screen that rendered a bare <h1> instead of the
          shared header — so it had no back button and no way out but the
          bottom bar. `showWallet` is off here: a chip linking to the page you
          are already on is noise. */}
      <FlexibleHeader
        title="محفظتي"
        subtitle="إدارة رصيدك ومعاملاتك"
        showBackButton
        showWallet={false}
      />

      {/* Balance Card */}
      <div className="px-5">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">الرصيد الحالي</p>
                <h2 className="text-2xl font-extrabold text-gray-800">
                  {isLoading ? '—' : formatNumber(data?.balance ?? 0)}{' '}
                  <span className="text-base font-bold text-gray-500">د.ع</span>
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-bold">
              <TrendingUp className="w-3 h-3" />
              نشط
            </div>
          </div>

          {/* Quick Actions */}
          {topup?.available ? (
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                dir="ltr"
                min={topup.minAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`الحد الأدنى ${topup.minAmount}`}
                aria-label="مبلغ الإيداع"
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={() => void startTopup()}
                disabled={starting || Number(amount) < (topup.minAmount ?? 1000)}
                className="bg-primary text-white py-3 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-md shadow-primary/20 disabled:opacity-50 disabled:active:scale-100"
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إيداع رصيد
              </button>
            </div>
          ) : null}
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
            <h3 className="text-lg font-extrabold text-gray-800">{formatNumber(totals.credit)} <span className="text-xs text-gray-400 font-bold">د.ع</span></h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">إجمالي المصروفات</span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-800">{formatNumber(totals.debit)} <span className="text-xs text-gray-400 font-bold">د.ع</span></h3>
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
            {error ? (
              <p className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-red-500">تعذّر تحميل المعاملات</p>
            ) : isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 h-[72px] animate-pulse" />
              ))
            ) : transactions.length === 0 ? (
              <p className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center text-sm text-gray-500">لا توجد معاملات بعد</p>
            ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 hover:border-primary/20 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'CREDIT' ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  {tx.type === 'CREDIT'
                    ? <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    : <ArrowUpRight className="w-5 h-5 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-sm truncate">
                    {REASON_LABELS[tx.reason] ?? tx.reason}
                  </h4>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {tx.description ?? (tx.order ? `طلب ${tx.order.orderNumber.slice(0, 8)}` : '—')}
                  </p>
                </div>
                <div className="text-end flex-shrink-0">
                  <p className={`text-sm font-extrabold ${
                    tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {tx.type === 'CREDIT' ? '+' : '−'}{formatNumber(tx.amount)} د.ع
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {formatRelative(tx.createdAt)}
                  </p>
                </div>
              </div>
            ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
