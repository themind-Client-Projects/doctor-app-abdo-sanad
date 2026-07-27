"use client";

import { useState } from "react";
import { Plus, Save, Percent } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 5: محرك النسب ⭐ (req L210-230) — "أهم جزء في وريد"
// 4 example splits, all per-contract, NEVER hardcoded (L230)
// ─────────────────────────────────────────────────────────────

interface CommissionSplit {
  label: string;
  parties: { name: string; percentage: number; color: string }[];
}

const exampleSplits: CommissionSplit[] = [
  {
    label: "استشارة حضورية",
    parties: [
      { name: "الطبيب", percentage: 70, color: "bg-blue-500" },
      { name: "المجمع", percentage: 20, color: "bg-emerald-500" },
      { name: "وريد", percentage: 10, color: "bg-purple-500" },
    ],
  },
  {
    label: "استشارة أونلاين",
    parties: [
      { name: "الطبيب", percentage: 80, color: "bg-blue-500" },
      { name: "وريد", percentage: 20, color: "bg-purple-500" },
    ],
  },
  {
    label: "تحليل منزلي",
    parties: [
      { name: "المختبر", percentage: 60, color: "bg-cyan-500" },
      { name: "الممرض", percentage: 15, color: "bg-pink-500" },
      { name: "السائق", percentage: 10, color: "bg-amber-500" },
      { name: "وريد", percentage: 15, color: "bg-purple-500" },
    ],
  },
  {
    label: "دواء مع توصيل",
    parties: [
      { name: "الصيدلية", percentage: 82, color: "bg-emerald-500" },
      { name: "السائق", percentage: 8, color: "bg-amber-500" },
      { name: "وريد", percentage: 10, color: "bg-purple-500" },
    ],
  },
];

export default function CommissionsPage() {
  const [splits, setSplits] = useState(exampleSplits);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Percent size={22} className="text-primary" />
            محرك النسب
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">⭐ أهم جزء في وريد — النسب حسب العقد، غير مبرمجة بشكل ثابت أبداً</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={16} /> إضافة قاعدة
        </button>
      </div>

      {/* Warning: never hardcoded (L230) */}
      <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          ⚠️ جميع النسب مرتبطة بالعقود — لا توجد نسب ثابتة في النظام (سطر 230 من المتطلبات)
        </p>
      </div>

      {/* 4 example commission splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {splits.map((split, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
            <h3 className="text-base font-semibold text-foreground mb-4">{split.label}</h3>

            {/* Visual bar */}
            <div className="flex h-8 rounded-lg overflow-hidden mb-4">
              {split.parties.map((party, j) => (
                <div
                  key={j}
                  className={`${party.color} flex items-center justify-center text-white text-xs font-bold transition-all`}
                  style={{ width: `${party.percentage}%` }}
                >
                  {party.percentage}%
                </div>
              ))}
            </div>

            {/* Party breakdown */}
            <div className="space-y-2">
              {split.parties.map((party, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${party.color}`} />
                    <span className="text-sm text-foreground">{party.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={party.percentage}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        newSplits[i].parties[j].percentage = Number(e.target.value);
                        setSplits(newSplits);
                      }}
                      className="w-16 h-8 rounded-md border border-input bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total validation */}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">الإجمالي</span>
              {(() => {
                const total = split.parties.reduce((acc, p) => acc + p.percentage, 0);
                return (
                  <span className={`text-sm font-bold ${total === 100 ? "text-emerald-600" : "text-red-600"}`}>
                    {total}%
                    {total !== 100 && <span className="text-xs mr-1">⚠️</span>}
                  </span>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
