"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AiCreditRecommendation } from "@/lib/creditAi";
import { BankCreditReview, BankRole, FinancingRequestStatus } from "@/lib/types";
import { money } from "./BankUI";

type Props = {
  requestId: string;
  status: FinancingRequestStatus;
  review?: BankCreditReview;
  suggestedAmount: number;
  suggestedRate: number;
  requestedTerm: number;
  aiSuggestion: AiCreditRecommendation;
  userRole: BankRole;
  collateralRequired: boolean;
  collateralApproved: boolean;
  collateralShortfall: number;
};

export default function CreditDecisionPanel({
  requestId,
  status,
  review,
  suggestedAmount,
  suggestedRate,
  requestedTerm,
  aiSuggestion,
  userRole,
  collateralRequired,
  collateralApproved,
  collateralShortfall,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(review?.approvedAmount || review?.recommendedAmount || suggestedAmount);
  const [rate, setRate] = useState(review?.approvedRate || review?.recommendedRate || suggestedRate);
  const [term, setTerm] = useState(review?.approvedTermMonths || review?.recommendedTermMonths || requestedTerm);
  const [rationale, setRationale] = useState(review?.rationale || aiSuggestion.rationale.join("\n"));
  const [conditions, setConditions] = useState((review?.conditions || aiSuggestion.conditions).join("\n"));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const approved = review?.finalDecision === "approved" || status === "approved";
  const rejected = review?.finalDecision === "rejected" || status === "rejected";
  const conditional = review?.finalDecision === "conditional" || status === "conditional_approval";
  const canDecide = ["admin", "credit_analyst", "risk_manager"].includes(userRole);
  const checklist = review?.conditionChecklist || [];
  const pendingConditions = useMemo(() => checklist.filter((item) => item.required && !["verified", "waived"].includes(item.status)), [checklist]);
  const canFinalApprove = pendingConditions.length === 0 && collateralApproved && collateralShortfall <= 0;

  async function request(action: string, payload: Record<string, unknown>) {
    setBusy(action); setError("");
    try {
      const response = await fetch(`/api/bank/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await response.json();
      if (!response.ok) {
        const blockers = Array.isArray(json.blockers) ? ` — ${json.blockers.join("، ")}` : "";
        throw new Error(`${json.error || "تعذر حفظ القرار."}${blockers}`);
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ القرار.");
    } finally { setBusy(""); }
  }

  function decide(decision: "approved" | "conditional" | "rejected") {
    return request(`decision-${decision}`, {
      action: "final_decision",
      decision,
      approvedAmount: Number(amount),
      approvedRate: Number(rate),
      approvedTermMonths: Number(term),
      rationale,
      conditions: conditions.split("\n").map((item) => item.trim()).filter(Boolean),
    });
  }

  if (approved) {
    return (
      <aside className="bank-card overflow-hidden border-emerald-200">
        <div className="bg-emerald-600 p-6 text-white"><CheckCircle2 className="h-9 w-9" /><h2 className="mt-4 text-xl font-bold">تمت الموافقة النهائية</h2><p className="mt-2 text-xs leading-6 text-emerald-50">اختفى مربع القرار. تبدأ الآن مرحلة توثيق الضمانات وتفعيل بوابة الصرف، ثم جدول الأقساط والمتابعة الشهرية.</p></div>
        <div className="space-y-3 p-5 text-sm"><ResultLine label="المبلغ المعتمد" value={money(review?.approvedAmount || amount)} /><ResultLine label="النسبة" value={`${Number(review?.approvedRate || rate).toFixed(2)}%`} /><ResultLine label="المدة" value={`${review?.approvedTermMonths || term} شهر`} /><DecisionSummary review={review} /></div>
      </aside>
    );
  }

  if (rejected) {
    return <aside className="bank-card overflow-hidden border-rose-200"><div className="bg-rose-600 p-6 text-white"><XCircle className="h-9 w-9" /><h2 className="mt-4 text-xl font-bold">تم رفض طلب التمويل</h2><p className="mt-2 text-xs leading-6 text-rose-50">تم حفظ القرار والمبررات في سجل الطلب.</p></div><div className="p-5"><DecisionSummary review={review} /></div></aside>;
  }

  if (conditional) {
    return (
      <aside className="bank-card overflow-hidden xl:sticky xl:top-28">
        <div className="bg-amber-500 p-6 text-white"><Clock3 className="h-9 w-9" /><h2 className="mt-4 text-xl font-bold">موافقة مبدئية مشروطة</h2><p className="mt-2 text-xs leading-6 text-amber-50">راجعي كل شرط، ثم اعتمدي الضمانات المرفوعة قبل إصدار الموافقة النهائية.</p></div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-2"><Mini label="المبلغ" value={money(review?.approvedAmount || amount, true)} /><Mini label="النسبة" value={`${Number(review?.approvedRate || rate).toFixed(2)}%`} /><Mini label="المدة" value={`${review?.approvedTermMonths || term} شهر`} /></div>
          <div>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">قائمة استيفاء الشروط</h3><span className="text-[10px] text-slate-500">{checklist.length - pendingConditions.length}/{checklist.length} مكتمل</span></div>
            <div className="mt-3 space-y-2">
              {checklist.length ? checklist.map((condition) => {
                const done = ["verified", "waived"].includes(condition.status);
                return <div key={condition.id} className={`rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5">{condition.title}</p><p className="mt-1 text-[9px] text-slate-400">{condition.category === "collateral" ? "ضمان" : condition.category === "document" ? "مستند" : condition.category === "financial" ? "شرط مالي" : "شرط ائتماني"}</p></div>{canDecide && <button onClick={() => request(`condition-${condition.id}`, { action: "update_condition", conditionId: condition.id, status: done ? "pending" : "verified" })} disabled={Boolean(busy)} className={`rounded-lg px-2 py-1 text-[9px] font-bold ${done ? "bg-white text-slate-600" : "bg-emerald-600 text-white"}`}>{done ? "إعادة فتح" : "تم التحقق"}</button>}</div></div>;
              }) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">لا توجد شروط مسجلة.</p>}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${collateralApproved && collateralShortfall <= 0 ? "border-emerald-200 bg-emerald-50" : "border-[#D9E2EC] bg-[#F8FAFC]"}`}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-bold">حالة الضمان قبل الموافقة النهائية</p></div><p className="mt-2 text-xs leading-6">{collateralApproved && collateralShortfall <= 0 ? "تم رفع واعتماد حزمة الضمان المطلوبة ائتمانياً. يمكن إصدار الموافقة النهائية بعد إغلاق الشروط." : collateralShortfall > 0 ? `يوجد عجز تغطية بقيمة ${money(collateralShortfall)}. يجب إضافة ضمان أو تخفيض مبلغ التمويل.` : "بانتظار رفع الشركة للضمانات واعتمادها من موظف البنك."}</p></div>

          {error && <ErrorBox text={error} />}
          {canDecide ? <button onClick={() => request("final-approval", { action: "final_approval", note: "تم التحقق من جميع شروط الموافقة المبدئية." })} disabled={Boolean(busy) || !canFinalApprove} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-40">{busy === "final-approval" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}اعتماد الموافقة النهائية</button> : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">هذا الحساب للعرض فقط.</p>}
          {!canFinalApprove && <p className="text-[10px] leading-5 text-slate-500">زر الموافقة النهائية يتفعل بعد استيفاء كل الشروط واعتماد حزمة الضمان دون عجز.</p>}
        </div>
      </aside>
    );
  }

  return (
    <aside className="bank-card p-5 xl:sticky xl:top-28">
      <div className="flex items-center gap-3"><div className="bank-icon-box h-11 w-11"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-bold">قرار الائتمان</h2><p className="mt-1 text-[10px] text-slate-500">مبدئي مشروط أولاً عند وجود ضمان، ثم نهائي بعد الاستيفاء</p></div></div>
      <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-[10px] font-bold text-violet-700">توصية الذكاء الائتماني</p><p className="mt-2 text-sm font-bold">{aiSuggestion.decision === "approve" ? "قبول مقترح" : aiSuggestion.decision === "conditional" ? "قبول مشروط" : aiSuggestion.decision === "reject" ? "رفض مقترح" : "مراجعة يدوية"}</p><p className="mt-1 text-[10px] text-slate-600">الثقة {aiSuggestion.confidence}% — القرار النهائي للموظف.</p></div>
      <div className="mt-5 space-y-4">
        <label className="bank-label">المبلغ المعتمد<input className="bank-input mt-2 w-full" type="number" min="0" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="bank-label">النسبة السنوية<input className="bank-input mt-2 w-full" type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label><label className="bank-label">المدة بالأشهر<input className="bank-input mt-2 w-full" type="number" min="1" max="120" value={term} onChange={(event) => setTerm(Number(event.target.value))} /></label></div>
        <label className="bank-label">الشروط — كل شرط في سطر<textarea className="bank-input mt-2 min-h-28 w-full" value={conditions} onChange={(event) => setConditions(event.target.value)} /></label>
        <label className="bank-label">مبررات القرار<textarea className="bank-input mt-2 min-h-24 w-full" value={rationale} onChange={(event) => setRationale(event.target.value)} /></label>
      </div>
      {collateralRequired && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">تقييم المخاطر يتطلب ضماناً مؤهلاً؛ استخدمي الموافقة المبدئية المشروطة حتى ترفع الشركة الضمان قبل الموافقة النهائية.</div>}
      {error && <ErrorBox text={error} />}
      {canDecide ? <div className="mt-5 grid gap-2"><button onClick={() => decide("conditional")} disabled={Boolean(busy) || amount <= 0 || !conditions.trim()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-bold text-white disabled:opacity-40">{busy === "decision-conditional" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}موافقة مبدئية مشروطة</button><button onClick={() => decide("approved")} disabled={Boolean(busy) || amount <= 0 || collateralRequired} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-40">{busy === "decision-approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}موافقة نهائية مباشرة</button><button onClick={() => decide("rejected")} disabled={Boolean(busy)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-50 text-xs font-bold text-rose-700 disabled:opacity-40">{busy === "decision-rejected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}رفض الطلب</button></div> : <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">هذا الحساب للعرض فقط ولا يملك صلاحية اعتماد القرار.</p>}
    </aside>
  );
}

function DecisionSummary({ review }: { review?: BankCreditReview }) { return <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold">سجل القرار</p><div className="mt-2 space-y-2 text-xs"><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>اعتمد بواسطة</span><strong>{review?.finalDecisionBy || review?.preliminaryDecisionBy || "موظف البنك"}</strong></div>{(review?.finalDecisionAt || review?.preliminaryDecisionAt) && <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>تاريخ الاعتماد</span><strong>{new Date(review.finalDecisionAt || review.preliminaryDecisionAt || "").toLocaleString("ar-SA")}</strong></div>}{review?.rationale && <div className="rounded-xl bg-slate-50 px-3 py-2 leading-6"><span className="text-slate-500">المبررات: </span>{review.rationale}</div>}</div></div>; }
function ResultLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-xs text-slate-500">{label}</span><strong>{value}</strong></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[9px] text-slate-400">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>; }
function ErrorBox({ text }: { text: string }) { return <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" />{text}</div>; }
