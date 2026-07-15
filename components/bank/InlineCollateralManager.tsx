"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { CollateralAsset, CollateralPackage } from "@/lib/types";
import { money, pct } from "./BankUI";

export default function InlineCollateralManager({ requestId, initialCollateral }: { requestId: string; initialCollateral: CollateralPackage }) {
  const router = useRouter();
  const [collateral, setCollateral] = useState(initialCollateral);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(`${action}:${String(payload.assetId || payload.type || "package")}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/bank/requests/${requestId}/collateral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await response.json();
      if (!response.ok) {
        const blockers = Array.isArray(json.blockers) ? ` — ${json.blockers.join("، ")}` : "";
        throw new Error(`${json.error || "تعذر تنفيذ الإجراء."}${blockers}`);
      }
      setCollateral(json.data.collateral);
      setMessage({ ok: true, text: "تم تحديث ملف الضمان وربطه بالطلب." });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "تعذر تنفيذ الإجراء." });
    } finally { setBusy(""); }
  }

  const existingTypes = new Set(collateral.assets.map((asset) => asset.type));
  const extraRecommendations = collateral.recommendations.filter((item) => !existingTypes.has(item.type)).slice(0, 5);
  const tangibleRequired = collateral.requiredEligibleValue > 0;

  return (
    <section className="space-y-5" id="collateral-workspace">
      <div className="bank-card overflow-hidden">
        <div className="bg-[#0B1F3A] p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#C9793B]"><ShieldCheck className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#C9793B]">الضمان خط الحماية الثاني</p><h2 className="mt-1 text-xl font-bold">حزمة الضمان من الموافقة المبدئية إلى الصرف</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-300">مصدر السداد الأساسي هو التدفق النقدي. لا تطلب المنصة عقاراً أو معدات تلقائياً لكل طلب؛ الحزمة تتدرج حسب DSCR والمخاطر والمديونية، ثم تطبق خصماً على القيمة قبل احتساب التغطية.</p></div></div>
            <div className="flex flex-wrap gap-2"><PackageStatus status={collateral.status} /><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${collateral.disbursementEligible ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"}`}>{collateral.disbursementEligible ? "مؤهل للصرف" : "الصرف محجوب"}</span></div>
          </div>
        </div>
        <CollateralJourney collateral={collateral} />
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4"><Summary label="قيمة التمويل المعتمدة" value={money(collateral.approvedFinancingAmount)} /><Summary label="التغطية المطلوبة" value={tangibleRequired ? `${pct(collateral.requiredCoverageRatio, true)} · ${money(collateral.requiredEligibleValue)}` : "لا يوجد ضمان عيني"} /><Summary label="القيمة المؤهلة الحالية" value={money(collateral.currentEligibleValue)} /><Summary label="عجز التغطية" value={money(collateral.shortfall)} danger={collateral.shortfall > 0} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bank-card p-5"><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-[#0B1F3A]" /><h3 className="font-bold">كيف تحسب التغطية؟</h3></div><div className="mt-4 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4 text-sm font-bold text-[#0B1F3A]">نسبة التغطية = القيمة المؤهلة للضمانات ÷ الرصيد التمويلي القائم × 100</div><p className="mt-3 text-xs leading-6 text-slate-600">القيمة المؤهلة لا تساوي القيمة السوقية. يُطبق Haircut ثم قيمة البيع السريع وتكاليف التسييل وحدود تركّز النوع. جميع النسب قابلة للتعديل وفق سياسة البنك مع حفظ التغيير في سجل الطلب.</p></div>
        <div className={`rounded-3xl border p-5 ${tangibleRequired ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center gap-2"><Landmark className="h-5 w-5" /><h3 className="font-bold">قرار الضمان لهذا الطلب</h3></div><p className="mt-3 text-sm font-bold">{tangibleRequired ? `تغطية مطلوبة ${pct(collateral.requiredCoverageRatio, true)}` : "تمويل دون ضمان عيني"}</p><p className="mt-2 text-xs leading-6">{tangibleRequired ? "يجب رفع قيمة مؤهلة كافية قبل الموافقة النهائية، ثم استكمال التوثيق القانوني قبل الصرف." : "يكفي متطلب التوثيق الخفيف الظاهر في الحزمة، مثل سند لأمر، قبل تفعيل الصرف."}</p></div>
      </div>

      {message && <div className={`rounded-2xl border p-4 text-xs ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div>}

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => act("send_to_company")} busy={busy.startsWith("send_to_company")} icon={Send} label="إرسال المتطلبات للشركة" />
        <ActionButton onClick={() => act("approve_package")} busy={busy.startsWith("approve_package")} icon={CheckCircle2} label="اعتماد الحزمة ائتمانياً" tone="green" />
        <ActionButton onClick={() => act("activate_package")} busy={busy.startsWith("activate_package")} icon={LockKeyhole} label="تفعيل بوابة الصرف" tone="dark" />
      </div>

      {extraRecommendations.length > 0 && tangibleRequired && <div className="bank-card p-5"><h3 className="font-bold">بدائل ضمان مناسبة لهذا الطلب</h3><p className="mt-1 text-xs text-slate-500">مرتبة وفق القطاع والقوائم والمخاطر. لا تضاف إلا إذا احتاج الموظف لتغطية العجز أو تحسين جودة الاسترداد.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{extraRecommendations.map((option) => <div key={option.type} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{option.label}</p><p className="mt-1 text-[10px] text-slate-500">ملاءمة {option.suitabilityScore}% · خصم متوقع {pct(option.expectedHaircut, true)} · مؤهل تقديري {money(option.estimatedEligibleValue)}</p></div><button onClick={() => act("add_recommendation", { type: option.type, mandatory: false })} disabled={Boolean(busy)} className="flex h-9 items-center gap-1 rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] px-3 text-[10px] font-bold text-[#0B1F3A] disabled:opacity-50"><Plus className="h-3.5 w-3.5" />إضافة</button></div><p className="mt-3 text-xs leading-5 text-slate-600">{option.reasons[0]}</p></div>)}</div></div>}

      <div className="space-y-4">{collateral.assets.map((asset) => <AssetCard key={asset.id} asset={asset} busy={busy} act={act} />)}</div>

      {(collateral.missingRequirements.length > 0 || collateral.concentrationWarnings.length > 0) && <div className="bank-card border-r-4 border-r-amber-400 p-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><h3 className="font-bold">متطلبات تمنع المرحلة التالية</h3></div><ul className="mt-4 space-y-2 text-xs leading-6 text-slate-700">{[...collateral.missingRequirements, ...collateral.concentrationWarnings].map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span className="text-amber-500">•</span>{item}</li>)}</ul></div>}
    </section>
  );
}

function CollateralJourney({ collateral }: { collateral: CollateralPackage }) {
  const steps = [
    { label: "تحديد المتطلب", done: true },
    { label: "رفع الشركة", done: Boolean(collateral.submittedAt) || ["under_review", "approved", "perfection_pending", "active"].includes(collateral.status) },
    { label: "الاعتماد الائتماني", done: Boolean(collateral.approvedAt) },
    { label: "التوثيق والنفاذ", done: collateral.allMandatoryPerfected },
    { label: "تفعيل الصرف", done: collateral.disbursementEligible },
  ];
  return <div className="overflow-x-auto border-b border-slate-100 bg-white p-5"><div className="flex min-w-[760px] items-center">{steps.map((step, index) => <div key={step.label} className="flex flex-1 items-center"><div className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${step.done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>{step.done ? <Check className="h-4 w-4" /> : index + 1}</div><p className="mt-2 text-[10px] font-bold">{step.label}</p></div>{index < steps.length - 1 && <div className={`mx-3 h-0.5 flex-1 ${steps[index + 1].done ? "bg-emerald-400" : "bg-slate-200"}`}><ArrowLeft className="hidden" /></div>}</div>)}</div></div>;
}

function AssetCard({ asset, busy, act }: { asset: CollateralAsset; busy: string; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const [marketValue, setMarketValue] = useState(String(asset.valuation.marketValue || ""));
  const [forcedSaleValue, setForcedSaleValue] = useState(asset.valuation.forcedSaleValue == null ? "" : String(asset.valuation.forcedSaleValue));
  const [haircut, setHaircut] = useState(String(asset.haircut));
  const [maximumCoverageShare, setMaximumCoverageShare] = useState(String(asset.maximumCoverageShare));
  const key = (action: string) => `${action}:${asset.id}`;
  return (
    <article className="bank-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{asset.label}</h3>{asset.mandatory && <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-bold text-rose-700">إلزامي</span>}<AssetStatus status={asset.status} /></div><p className="mt-2 text-xs leading-6 text-slate-600">{asset.description}</p><p className="mt-2 text-[10px] text-slate-400">المالك: {asset.ownerName} · المستندات: {asset.documents.length} · المعتمد: {asset.documents.filter((document) => document.status === "verified").length}</p></div><div className="grid min-w-[300px] grid-cols-3 gap-2 text-center"><Mini label="السوقية" value={money(asset.valuation.marketValue)} /><Mini label="المؤهلة" value={money(asset.cappedEligibleValue)} /><Mini label="الخصم" value={pct(asset.haircut, true)} /></div></div>
      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_auto] xl:items-end"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input label="القيمة السوقية" value={marketValue} onChange={setMarketValue} /><Input label="قيمة البيع السريع" value={forcedSaleValue} onChange={setForcedSaleValue} /><Input label="Haircut (مثال 0.25)" value={haircut} step="0.01" onChange={setHaircut} /><Input label="حد مساهمة النوع" value={maximumCoverageShare} step="0.01" onChange={setMaximumCoverageShare} /></div><button onClick={() => act("update_valuation", { assetId: asset.id, marketValue, forcedSaleValue, haircut, maximumCoverageShare })} disabled={Boolean(busy)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] px-4 text-xs font-bold text-[#0B1F3A] disabled:opacity-50">{busy === key("update_valuation") ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}حفظ التقييم والسياسة</button></div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 p-4"><SmallAction label="اعتماد الضمان" icon={FileCheck2} onClick={() => act("approve_asset", { assetId: asset.id })} busy={busy === key("approve_asset")} tone="green" /><SmallAction label="طلب استكمال" icon={Send} onClick={() => act("request_correction", { assetId: asset.id })} busy={busy === key("request_correction")} /><SmallAction label="رفض الضمان" icon={XCircle} onClick={() => act("reject_asset", { assetId: asset.id })} busy={busy === key("reject_asset")} tone="red" /><SmallAction label="إثبات التوثيق والنفاذ" icon={LockKeyhole} onClick={() => act("perfect_asset", { assetId: asset.id })} busy={busy === key("perfect_asset")} tone="dark" /></div>
    </article>
  );
}

function Input({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) { return <label className="bank-label">{label}<input className="bank-input mt-2 w-full" type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Summary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="bg-white p-5"><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-2 text-lg font-bold ${danger ? "text-rose-600" : "text-slate-900"}`}>{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] text-slate-400">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>; }
function PackageStatus({ status }: { status: string }) { const labels: Record<string, string> = { recommended: "مقترحة", awaiting_submission: "بانتظار الشركة", under_review: "تحت المراجعة", approved: "معتمدة ائتمانياً", perfection_pending: "بانتظار التوثيق", shortfall: "عجز تغطية", active: "نشطة", enforcement: "تنفيذ", released: "مفكوكة" }; return <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white">{labels[status] || status}</span>; }
function AssetStatus({ status }: { status: string }) { const cls = ["approved", "perfected", "active"].includes(status) ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"; const labels: Record<string, string> = { requested: "مطلوب من الشركة", submitted: "مرفوع للمراجعة", under_review: "تحت المراجعة", approved: "معتمد", rejected: "مرفوض", perfection_pending: "بانتظار التوثيق", perfected: "موثق ونافذ", active: "نشط", recommended: "مقترح" }; return <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${cls}`}>{labels[status] || status}</span>; }
function ActionButton({ onClick, busy, icon: Icon, label, tone = "primary" }: { onClick: () => void; busy: boolean; icon: typeof Send; label: string; tone?: "primary" | "green" | "dark" }) { const cls = tone === "green" ? "bg-emerald-600 text-white" : tone === "dark" ? "bg-[#0B1F3A] text-white" : "bg-[#0B1F3A] text-white"; return <button onClick={onClick} disabled={busy} className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-50 ${cls}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>; }
function SmallAction({ label, icon: Icon, onClick, busy, tone = "primary" }: { label: string; icon: typeof Send; onClick: () => void; busy: boolean; tone?: "primary" | "green" | "red" | "dark" }) { const cls = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-rose-50 text-rose-700" : tone === "dark" ? "bg-slate-200 text-slate-800" : "border border-[#D9E2EC] bg-[#F8FAFC] text-[#0B1F3A]"; return <button onClick={onClick} disabled={busy} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-bold disabled:opacity-50 ${cls}`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{label}</button>; }
