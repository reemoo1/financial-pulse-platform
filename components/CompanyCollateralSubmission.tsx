"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  CollateralAsset,
  CollateralDocument,
  CollateralPackage,
} from "@/lib/types";

const DOC_TYPES: Array<{ value: CollateralDocument["type"]; label: string }> = [
  { value: "ownership", label: "إثبات ملكية" },
  { value: "valuation", label: "تقييم" },
  { value: "insurance", label: "تأمين" },
  { value: "registration", label: "تسجيل أو رهن" },
  { value: "assignment", label: "حوالة مستحقات" },
  { value: "guarantee_letter", label: "خطاب ضمان" },
  { value: "promissory_note", label: "سند لأمر" },
  { value: "financial_statement", label: "قوائم مالية" },
  { value: "other", label: "مستند آخر" },
];

export default function CompanyCollateralSubmission({
  requestId,
  initialCollateral,
}: {
  requestId: string;
  initialCollateral: CollateralPackage;
}) {
  const router = useRouter();
  const [collateral, setCollateral] = useState(initialCollateral);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const locked = [
    "under_review",
    "approved",
    "perfection_pending",
    "active",
    "enforcement",
    "released",
  ].includes(collateral.status);
  const declaredPotentialEligibleValue = Math.round(
    collateral.assets.reduce(
      (sum, asset) => sum + Math.max(asset.cappedEligibleValue || 0, 0),
      0,
    ),
  );
  const approvedRequirementFulfillment =
    collateral.requiredEligibleValue > 0
      ? collateral.currentEligibleValue / collateral.requiredEligibleValue
      : 0;
  const potentialRequirementFulfillment =
    collateral.requiredEligibleValue > 0
      ? declaredPotentialEligibleValue / collateral.requiredEligibleValue
      : 0;

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/company/financing-requests/${requestId}/collateral`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          [json.error, ...(json.blockers || [])].filter(Boolean).join(" — "),
        );
      setCollateral(json.data.collateral);
      setMessage({
        type: "ok",
        text:
          action === "submit_package"
            ? "تم إرسال الضمانات للبنك للمراجعة."
            : "تم حفظ بيانات الضمان.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.",
      });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className="fp-hero-band p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#D88945]" />
            </div>
            <div>
              <p className="text-xs text-[#C9793B]/80">متطلبات ما قبل الصرف</p>
              <h1 className="text-2xl font-bold mt-1">استكمال الضمانات</h1>
              <p className="text-sm text-slate-300 mt-3 leading-7 max-w-2xl">
                أدخلي بيانات كل ضمان وارفعِي المستندات المطلوبة. البنك يتحقق من
                القيم والملكية ثم يستكمل التوثيق القانوني.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[280px] lg:min-w-[520px]">
            <Stat
              label="قيمة التمويل المعتمدة"
              value={formatMoney(collateral.approvedFinancingAmount)}
            />
            <Stat
              label="نسبة التغطية المطلوبة"
              value={formatPercent(collateral.requiredCoverageRatio)}
            />
            <Stat
              label="الضمان المؤهل المطلوب"
              value={formatMoney(collateral.requiredEligibleValue)}
            />
            <Stat
              label="التغطية المعتمدة حاليًا"
              value={formatPercent(collateral.coverageRatio)}
            />
          </div>
        </div>
      </section>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm ${message.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}
        >
          {message.text}
        </div>
      )}
      {locked && (
        <div className="rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4 text-sm text-[#13294B] flex gap-3">
          <LockKeyhole className="w-5 h-5 shrink-0" />
          الحزمة الآن لدى البنك أو تم اعتمادها، لذلك التعديل متوقف. ستظهر أي
          طلبات استكمال جديدة هنا لاحقاً.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label="القيمة المقدرة قبل اعتماد البنك"
          value={formatMoney(declaredPotentialEligibleValue)}
          note={`تغطي ${formatPercent(potentialRequirementFulfillment)} من المتطلب وفق القيم المدخلة قبل التحقق.`}
        />
        <Summary
          label="القيمة المؤهلة المعتمدة"
          value={formatMoney(collateral.currentEligibleValue)}
          note={`تم استيفاء ${formatPercent(approvedRequirementFulfillment)} من الضمان المطلوب.`}
        />
        <Summary
          label="العجز المعتمد الحالي"
          value={formatMoney(collateral.shortfall)}
          note="ينخفض فقط بعد اعتماد البنك للضمانات والقيم المؤهلة."
        />
        <Summary
          label="حالة الحزمة"
          value={packageLabel(collateral.status)}
          note={`${collateral.assets.length} ضمانات · ${collateral.assets.reduce(
            (sum, asset) => sum + asset.documents.length,
            0,
          )} مستندات`}
        />
      </section>

      <section className="rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC]/60 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-[#0B1F3A]" />
          <div>
            <h3 className="font-bold text-slate-900">كيف تُحسب قيمة الضمان؟</h3>
            <div className="mt-2 space-y-1 text-xs leading-6 text-slate-600">
              <p>
                الضمان المؤهل المطلوب = قيمة التمويل المعتمدة × نسبة التغطية
                المطلوبة.
              </p>
              <p>
                القيمة المؤهلة لكل أصل = الأقل من قيمة البيع السريع والقيمة
                السوقية بعد خصم المخاطر، ثم تُطرح تكاليف التسييل ويُخصم أثر مدة
                الاسترداد وتُطبق حدود التركّز.
              </p>
              <p className="font-semibold text-[#13294B]">
                القيم التي تدخلها الشركة تبقى تقديرية، ولا تدخل في التغطية
                المعتمدة إلا بعد تحقق البنك من الملكية والتقييم والمستندات.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {collateral.assets.map((asset) => (
          <CompanyAsset
            key={asset.id}
            requestId={requestId}
            asset={asset}
            locked={locked}
            onSaved={(next) => {
              setCollateral(next);
              router.refresh();
            }}
            onUpdate={(payload) =>
              act("update_asset", { assetId: asset.id, ...payload })
            }
          />
        ))}
      </div>

      {!locked && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">إرسال الحزمة للبنك</h3>
            <p className="text-xs text-slate-500 mt-2">
              تأكدي من رفع مستند لكل ضمان إلزامي قبل الإرسال.
            </p>
          </div>
          <button
            disabled={Boolean(busy)}
            onClick={() => act("submit_package")}
            className="h-12 px-6 rounded-xl bg-[#0B1F3A] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === "submit_package" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            إرسال للمراجعة
          </button>
        </section>
      )}
    </div>
  );
}

function CompanyAsset({
  requestId,
  asset,
  locked,
  onSaved,
  onUpdate,
}: {
  requestId: string;
  asset: CollateralAsset;
  locked: boolean;
  onSaved: (collateral: CollateralPackage) => void;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  const [ownerName, setOwnerName] = useState(asset.ownerName);
  const [identifier, setIdentifier] = useState(asset.identifier || "");
  const [description, setDescription] = useState(asset.description);
  const [marketValue, setMarketValue] = useState(
    String(asset.valuation.marketValue || ""),
  );
  const [forcedSaleValue, setForcedSaleValue] = useState(
    asset.valuation.forcedSaleValue == null
      ? ""
      : String(asset.valuation.forcedSaleValue),
  );
  const [realisationCosts, setRealisationCosts] = useState(
    String(asset.valuation.realisationCosts || 0),
  );
  const [timeToRealiseMonths, setTimeToRealiseMonths] = useState(
    String(asset.valuation.timeToRealiseMonths || 0),
  );
  const [discountRatePercent, setDiscountRatePercent] = useState(
    String((asset.valuation.discountRate || 0) * 100),
  );
  const [valuer, setValuer] = useState(asset.valuation.valuer || "");
  const [valuationDate, setValuationDate] = useState(
    asset.valuation.valuationDate || "",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("assetId", asset.id);
      const response = await fetch(
        `/api/company/financing-requests/${requestId}/collateral/documents`,
        { method: "POST", body: form },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "تعذر رفع المستند.");
      onSaved(json.data.collateral);
      event.currentTarget.reset();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "تعذر رفع المستند.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] text-[#0B1F3A] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{asset.label}</h3>
            {asset.mandatory && (
              <span className="rounded-md bg-rose-50 text-rose-600 px-2 py-1 text-[9px] font-bold">
                إلزامي
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {asset.conditions.slice(0, 2).join(" · ")}
          </p>
        </div>
        <span className="mr-auto rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
          {assetStatus(asset.status)}
        </span>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label>
            <span className="text-xs text-slate-500">اسم المالك</span>
            <input
              disabled={locked}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">الرقم المرجعي</span>
            <input
              disabled={locked}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
              placeholder="صك، رقم تسلسلي، عقد"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">القيمة السوقية</span>
            <input
              disabled={locked || asset.type === "promissory_note"}
              type="number"
              min="0"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">قيمة البيع السريع</span>
            <input
              disabled={locked || asset.type === "promissory_note"}
              type="number"
              min="0"
              value={forcedSaleValue}
              onChange={(e) => setForcedSaleValue(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">
              تكاليف التنفيذ والتسييل
            </span>
            <input
              disabled={locked || asset.type === "promissory_note"}
              type="number"
              min="0"
              value={realisationCosts}
              onChange={(e) => setRealisationCosts(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">
              مدة التسييل المتوقعة (شهر)
            </span>
            <input
              disabled={locked || asset.type === "promissory_note"}
              type="number"
              min="0"
              max="120"
              value={timeToRealiseMonths}
              onChange={(e) => setTimeToRealiseMonths(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">معدل خصم الاسترداد %</span>
            <input
              disabled={locked || asset.type === "promissory_note"}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={discountRatePercent}
              onChange={(e) => setDiscountRatePercent(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-slate-500">وصف الضمان</span>
            <input
              disabled={locked}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">جهة التقييم</span>
            <input
              disabled={locked}
              value={valuer}
              onChange={(e) => setValuer(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-slate-500">تاريخ التقييم</span>
            <input
              disabled={locked}
              type="date"
              value={valuationDate}
              onChange={(e) => setValuationDate(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-2 text-sm"
            />
          </label>
        </div>
        {!locked && (
          <button
            onClick={() =>
              onUpdate({
                ownerName,
                identifier,
                description,
                marketValue: Number(marketValue || 0),
                forcedSaleValue:
                  forcedSaleValue === "" ? null : Number(forcedSaleValue),
                realisationCosts: Number(realisationCosts || 0),
                timeToRealiseMonths: Number(timeToRealiseMonths || 0),
                discountRate: Number(discountRatePercent || 0) / 100,
                valuer,
                valuationDate,
              })
            }
            className="h-10 px-5 rounded-xl bg-[#071a2f] text-white text-xs font-bold"
          >
            حفظ بيانات الضمان
          </button>
        )}

        {asset.type !== "promissory_note" && (
          <div className="grid gap-3 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC]/50 p-4 sm:grid-cols-3">
            <AssetValue
              label="خصم نوع الضمان"
              value={formatPercent(asset.haircut)}
            />
            <AssetValue
              label="القيمة المؤهلة قبل حد التركّز"
              value={formatMoney(asset.eligibleValue)}
            />
            <AssetValue
              label="القيمة المحتسبة بعد حد التركّز"
              value={formatMoney(asset.cappedEligibleValue)}
            />
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#0B1F3A]" />
            المستندات المرفوعة
          </h4>
          <div className="space-y-2 mt-3">
            {asset.documents.map((document) => (
              <div
                key={document.id}
                className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3"
              >
                <FileCheck2 className="w-4 h-4 text-slate-500" />
                <div className="min-w-0">
                  <a
                    href={`/api/collateral-documents/${requestId}/${document.id}`}
                    className="text-xs font-bold truncate hover:text-[#0B1F3A]"
                  >
                    {document.name}
                  </a>
                  <p className="text-[10px] text-slate-400">
                    {document.status === "verified"
                      ? "تم التحقق من البنك"
                      : document.status === "rejected"
                        ? "مرفوض ويحتاج استبدال"
                        : "بانتظار تحقق البنك"}
                  </p>
                </div>
                {document.status === "verified" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-auto" />
                ) : document.status === "rejected" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 mr-auto" />
                ) : null}
              </div>
            ))}
            {asset.documents.length === 0 && (
              <p className="text-xs text-slate-400">لم يتم رفع مستندات بعد.</p>
            )}
          </div>
          {!locked && (
            <form
              onSubmit={upload}
              className="grid sm:grid-cols-[1fr_170px_auto] gap-2 mt-4"
            >
              <input
                required
                name="file"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                className="rounded-xl border border-slate-200 bg-white p-2 text-[10px]"
              />
              <select
                name="documentType"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"
              >
                {DOC_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                disabled={uploading}
                className="h-10 px-4 rounded-xl bg-[#0B1F3A] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                رفع
              </button>
            </form>
          )}
          {uploadError && (
            <p className="text-xs text-rose-600 mt-2">{uploadError}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-bold mt-2">{value}</p>
    </div>
  );
}
function Summary({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-2 text-[11px] leading-5 text-slate-500">{note}</p>}
    </div>
  );
}
function AssetValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">
        {value}
      </p>
    </div>
  );
}
function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("ar-SA")} ر.س`;
}
function formatPercent(value: number) {
  return `${(Math.max(value || 0, 0) * 100).toLocaleString("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}
function packageLabel(status: CollateralPackage["status"]) {
  return (
    (
      {
        draft: "مسودة",
        recommended: "تم تحديد المتطلبات",
        awaiting_submission: "بانتظار الاستكمال",
        under_review: "لدى البنك للمراجعة",
        approved: "معتمدة",
        perfection_pending: "تحت التوثيق القانوني",
        active: "نشطة",
        shortfall: "تحتاج تغطية إضافية",
        enforcement: "تحت التنفيذ",
        released: "تم فكها",
      } as Record<string, string>
    )[status] || status
  );
}
function assetStatus(status: CollateralAsset["status"]) {
  return (
    (
      {
        recommended: "موصى به",
        requested: "مطلوب",
        submitted: "مستلم",
        under_review: "تحت الفحص",
        approved: "معتمد",
        rejected: "مرفوض",
        perfection_pending: "تحت التوثيق",
        perfected: "نافذ",
        active: "نشط",
        released: "مفكوك",
        enforcement: "قيد التنفيذ",
        liquidated: "تمت التصفية",
      } as Record<string, string>
    )[status] || status
  );
}
