"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calculator,
  Loader2,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CreditCalculationOverrides, FundingRecommendation } from "@/lib/types";
import { money } from "./BankUI";

type Props = {
  requestId: string;
  requestedAmount: number;
  requestedTerm: number;
  currentDebtRatio?: number | null;
  policyCoveragePercent: number;
  funding: FundingRecommendation;
  overrides?: CreditCalculationOverrides;
};

type EditableKey =
  | "requestedAmountOverride"
  | "termMonthsOverride"
  | "maximumDebtRatioPercent"
  | "requiredCollateralCoveragePercent"
  | "targetDscr"
  | "policyReferenceRate"
  | "riskPremium"
  | "cashFlowCapacity"
  | "assetBackedCapacity"
  | "leverageCapacity"
  | "revenueCapacity";

export default function EditableFinancingCalculation({
  requestId,
  requestedAmount,
  requestedTerm,
  currentDebtRatio,
  policyCoveragePercent,
  funding,
  overrides,
}: Props) {
  const router = useRouter();
  const base = funding.calculation;
  const defaults = useMemo(
    () => ({
      requestedAmountOverride: overrides?.requestedAmountOverride ?? requestedAmount,
      termMonthsOverride: overrides?.termMonthsOverride ?? requestedTerm,
      maximumDebtRatioPercent: overrides?.maximumDebtRatioPercent ?? 70,
      requiredCollateralCoveragePercent:
        overrides?.requiredCollateralCoveragePercent ?? policyCoveragePercent,
      targetDscr: overrides?.targetDscr ?? base?.targetDscr ?? 1.3,
      policyReferenceRate:
        overrides?.policyReferenceRate ?? base?.policyReferenceRate ?? 5,
      riskPremium:
        overrides?.riskPremium ??
        base?.riskPremium ??
        Math.max(0, funding.interestRate - 5),
      cashFlowCapacity:
        overrides?.cashFlowCapacity ?? base?.cashFlowCapacity ?? null,
      assetBackedCapacity:
        overrides?.assetBackedCapacity ?? base?.assetBackedCapacity ?? null,
      leverageCapacity:
        overrides?.leverageCapacity ?? base?.leverageCapacity ?? null,
      revenueCapacity:
        overrides?.revenueCapacity ?? base?.revenueCapacity ?? null,
    }),
    [
      base,
      funding.interestRate,
      overrides,
      policyCoveragePercent,
      requestedAmount,
      requestedTerm,
    ],
  );

  const [values, setValues] = useState(defaults);
  const [note, setNote] = useState(overrides?.note || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const capacities = [
    ["التدفق النقدي", values.cashFlowCapacity],
    ["الأصول", values.assetBackedCapacity],
    ["الرافعة", values.leverageCapacity],
    ["الإيرادات", values.revenueCapacity],
  ] as const;
  const usable = capacities
    .map(([, value]) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const requestCap = Math.max(0, Number(values.requestedAmountOverride || requestedAmount));
  const adjustedAmount = Math.max(
    0,
    Math.min(
      requestCap,
      ...(usable.length ? usable : [funding.amount || requestCap]),
    ),
  );
  const adjustedRate = Math.max(
    0,
    Number(values.policyReferenceRate) + Number(values.riskPremium),
  );
  const binding =
    capacities
      .filter(([, value]) => Number(value) > 0)
      .sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] ||
    base?.bindingConstraint ||
    "المبلغ المطلوب";
  const chartData = capacities
    .map(([name, value]) => ({ name, value: Math.round(Number(value || 0)) }))
    .filter((item) => item.value > 0);

  function update(key: EditableKey, raw: string) {
    const numeric = raw === "" ? null : Number(raw);
    setValues((current) => ({ ...current, [key]: numeric }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/bank/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_calculation_override",
          overrides: {
            ...values,
            analystRecommendedAmount: adjustedAmount,
            analystRecommendedRate: adjustedRate,
            note,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر حفظ التعديلات.");
      setMessage({
        ok: true,
        text: "تم حفظ مدة السداد وتحديث المراجعة بنجاح.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "تعذر حفظ التعديلات.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bank-analysis-section" id="calculation-workspace">
      <div className="bank-section-heading bank-section-heading-split">
        <div className="flex items-start gap-3">
          <div className="bank-section-icon"><Calculator className="h-5 w-5" /></div>
          <div>
            <h2>كيف حسبنا هذا؟</h2>
          </div>
        </div>
        <span className="bank-review-pill"><SlidersHorizontal className="h-3.5 w-3.5" />مدة السداد قابلة للتعديل</span>
      </div>

      <div className="rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-5">
        <div className="max-w-sm">
          <EditNumber label="مدة السداد" value={values.termMonthsOverride} suffix="شهر" step="1" onChange={(value) => update("termMonthsOverride", value)} />
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-600">جميع القيم المالية محسوبة تلقائيًا من البيانات المعتمدة. التعديل المتاح لموظف البنك يقتصر على مدة السداد فقط.</p>
      </div>

      <div className="bank-analysis-columns">
        <div>
          <h3 className="bank-subheading">حدود القدرة التمويلية المحسوبة</h3>
          <div className="bank-result-lines mt-4">
            {capacities.map(([label, value]) => (
              <Result
                key={label}
                label={label}
                value={Number(value) > 0 ? money(Number(value)) : "غير متوفر"}
                note={
                  label === "التدفق النقدي" && !(Number(value) > 0)
                    ? "غير متوفر لعدم اكتمال CFADS أو التدفق النقدي التشغيلي والإنفاق الرأسمالي الضروري وبيانات خدمة الدين في الملف المرفوع."
                    : undefined
                }
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={save} disabled={busy || adjustedAmount <= 0} className="bank-primary-button">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ مدة السداد
            </button>
            <button onClick={() => setValues(defaults)} disabled={busy} className="bank-secondary-button">
              <RotateCcw className="h-4 w-4" />إعادة المدة المحفوظة
            </button>
          </div>
          {message && <div className={`mt-4 bank-inline-message ${message.ok ? "is-ok" : "is-error"}`}>{message.text}</div>}
        </div>

        <div className="space-y-5">
          <div className="bank-result-lines">
            <Result label="المبلغ بعد التعديل" value={money(adjustedAmount)} tone="green" />
            <Result label="النسبة بعد التعديل" value={`${adjustedRate.toFixed(2)}%`} tone="blue" />
            <Result label="المدة المعتمدة للمراجعة" value={`${Math.round(Number(values.termMonthsOverride || requestedTerm))} شهر`} />
            <Result label="القيد الحاكم" value={binding} />
            <Result label="المديونية الحالية" value={currentDebtRatio == null ? "غير متوفرة" : `${(currentDebtRatio * 100).toFixed(1)}%`} />
            <Result label="مبلغ العميل الأصلي" value={money(requestedAmount)} />
          </div>

          <div className="bank-chart-panel">
            <div className="bank-chart-title"><BarChart3 className="h-4 w-4" /><span>مقارنة حدود القدرة التمويلية</span></div>
            {chartData.length ? (
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 6, left: 6, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} height={55} fontSize={10} />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} fontSize={10} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-xs text-slate-500">لا تتوفر قيود كمية كافية للرسم.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditNumber({
  label,
  value,
  onChange,
  suffix,
  step = "1",
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: string) => void;
  suffix: string;
  step?: string;
}) {
  return (
    <label className="bank-edit-line">
      <span>{label}</span>
      <div>
        <input type="number" min="0" step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function Result({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "green" | "blue";
  note?: string;
}) {
  return (
    <div className={`bank-result-line ${note ? "has-note" : ""} ${tone ? `is-${tone}` : ""}`}>
      <div>
        <span>{label}</span>
        {note && <small className="bank-result-note">{note}</small>}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
