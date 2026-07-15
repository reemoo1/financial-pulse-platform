"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { FinancingInstallment, FinancingRequestStatus } from "@/lib/types";
import { date, money } from "./BankUI";

const today = () => new Date().toISOString().slice(0, 10);

type HeaderInfo = {
  referenceNumber: string;
  applicantName: string;
  financingAmount: number;
  termMonths: number;
  startDate: string | null;
  endDate: string | null;
  status: FinancingRequestStatus;
};

function daysUntil(dueDate: string): number {
  const diffMs = new Date(dueDate).getTime() - new Date(today()).getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function installmentTone(item: FinancingInstallment): "paid" | "overdue" | "soon" | "upcoming" {
  if (item.status === "paid" || item.status === "waived") return "paid";
  if (item.status === "late" || item.daysPastDue > 0) return "overdue";
  const remaining = daysUntil(item.dueDate);
  if (remaining <= 7) return "soon";
  return "upcoming";
}

const TONE_STYLES: Record<string, { card: string; badge: string; text: string }> = {
  paid: { card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-600 text-white", text: "تم السداد" },
  overdue: { card: "border-rose-200 bg-rose-50", badge: "bg-rose-600 text-white", text: "متأخرة" },
  soon: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-500 text-white", text: "موعد السداد قريب" },
  upcoming: { card: "border-slate-200 bg-white", badge: "bg-slate-200 text-slate-600", text: "قادمة" },
};

export default function PaymentTimeline({
  requestId,
  header,
  installments,
}: {
  requestId: string;
  header: HeaderInfo;
  installments: FinancingInstallment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const unpaid = installments.filter((item) => item.status !== "paid" && item.status !== "waived");
  const firstUnpaid = unpaid[0];
  const [paidAmount, setPaidAmount] = useState(
    firstUnpaid ? Math.max(0, firstUnpaid.amountDue - firstUnpaid.paidAmount) : 0
  );

  const overdueCount = installments.filter((item) => installmentTone(item) === "overdue").length;
  const soonCount = installments.filter((item) => installmentTone(item) === "soon").length;
  const allPaid = installments.length > 0 && installments.every((item) => item.status === "paid" || item.status === "waived");

  async function recordPayment() {
    if (!firstUnpaid) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/bank/requests/${requestId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_installment_payment",
          installmentId: firstUnpaid.id,
          paidAmount,
          paidAt: today(),
          daysPastDue: 0,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر تسجيل السداد.");
      setMessage({ ok: true, text: "تم تسجيل السداد وتحديث حالة الدفعة." });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "تعذر تسجيل السداد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bank-card p-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="bank-icon-box h-11 w-11">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">{header.applicantName}</h2>
            <p className="mt-1 text-[10px] text-slate-500">رقم الطلب {header.referenceNumber}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="قيمة التمويل" value={money(header.financingAmount)} />
          <MiniStat label="مدة التمويل" value={`${header.termMonths} شهر`} />
          <MiniStat label="تاريخ البداية" value={header.startDate ? date(header.startDate) : "—"} />
          <MiniStat label="تاريخ النهاية" value={header.endDate ? date(header.endDate) : "—"} />
          <MiniStat label="عدد الدفعات" value={String(installments.length)} />
          <MiniStat label="حالة التمويل" value={header.status} />
        </div>
      </div>

      {/* Alert banner (visual notification, per product decision) */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          يوجد {overdueCount} دفعة متأخرة تحتاج متابعة فورية.
        </div>
      )}
      {overdueCount === 0 && soonCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          <Clock3 className="h-5 w-5 shrink-0" />
          يوجد {soonCount} دفعة يقترب موعد استحقاقها خلال 7 أيام.
        </div>
      )}
      {allPaid && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-5 w-5 shrink-0" />
          تم سداد جميع الدفعات المستحقة على هذا الطلب.
        </div>
      )}

      {/* Payment timeline */}
      <div className="bank-card p-5">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-[#0B1F3A]" />
          <h3 className="font-bold">خطة السداد</h3>
        </div>

        {installments.length ? (
          <div className="mt-5 space-y-3">
            {installments.map((item) => {
              const tone = installmentTone(item);
              const style = TONE_STYLES[tone];
              const remainingAmount = Math.max(0, item.amountDue - item.paidAmount);
              return (
                <div key={item.id} className={`rounded-2xl border p-4 ${style.card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${style.badge}`}>
                        {tone === "paid" ? <Check className="h-4 w-4" /> : item.sequence}
                      </div>
                      <div>
                        <p className="text-sm font-bold">الدفعة {item.sequence}</p>
                        <p className="text-[10px] text-slate-500">استحقاق {date(item.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400">المبلغ</p>
                        <p className="font-bold">{money(item.amountDue)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400">المتبقي</p>
                        <p className="font-bold">{money(remainingAmount)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${style.badge}`}>{style.text}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 py-10 text-center text-xs text-slate-500">لا يوجد جدول سداد نشط لهذا الطلب بعد.</p>
        )}

        {firstUnpaid && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-bold">تسجيل سداد الدفعة {firstUnpaid.sequence}</p>
                <p className="mt-1 text-[10px] text-slate-500">استحقاق {date(firstUnpaid.dueDate)}</p>
              </div>
              <input
                type="number"
                min="0"
                className="bank-input w-36"
                value={paidAmount}
                onChange={(event) => setPaidAmount(Number(event.target.value))}
              />
              <button
                onClick={recordPayment}
                disabled={busy || paidAmount <= 0}
                className="bank-btn-primary h-11 px-4 text-xs disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                تسجيل السداد
              </button>
            </div>
            {message && (
              <p className={`mt-3 text-xs font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>
                {message.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-bold">{value}</p>
    </div>
  );
}
