import { CollateralAsset, CollateralPackage } from "@/lib/types";
import { date, money, pct } from "./BankUI";
import { ShieldCheck } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  cash_deposit: "وديعة نقدية",
  bank_guarantee: "خطاب ضمان بنكي",
  kafalah: "كفالة",
  real_estate: "عقار",
  equipment: "معدات",
  vehicle: "مركبة",
  inventory: "مخزون",
  receivables: "ذمم مدينة",
  corporate_guarantee: "كفالة شركة",
  personal_guarantee: "كفالة شخصية",
};

const STATUS_LABELS: Record<string, string> = {
  recommended: "مقترح",
  requested: "مطلوب من الشركة",
  submitted: "مرفوع للمراجعة",
  under_review: "تحت المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  perfection_pending: "بانتظار التوثيق",
  perfected: "موثق ونافذ",
  active: "نشط",
};

function coverageOf(asset: CollateralAsset): number {
  const market = Number(asset.valuation.marketValue || 0);
  if (market <= 0) return 0;
  return Number(asset.cappedEligibleValue || 0) / market;
}

function approvalDate(asset: CollateralAsset): string {
  const isApproved = ["approved", "perfection_pending", "perfected", "active"].includes(asset.status);
  return isApproved ? date(asset.updatedAt) : "—";
}

export default function CollateralOverview({ collateral }: { collateral: CollateralPackage }) {
  // Promissory notes are excluded entirely per product decision — not shown anywhere in this view.
  const assets = collateral.assets.filter((asset) => asset.type !== "promissory_note");

  return (
    <section className="space-y-5">
      <div className="bank-card p-5">
        <div className="flex items-center gap-3">
          <div className="bank-icon-box h-11 w-11">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">قائمة الضمانات</h2>
            <p className="mt-1 text-[10px] text-slate-500">{assets.length} ضمان مرتبط بهذا الطلب</p>
          </div>
        </div>
      </div>

      {assets.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {assets.map((asset) => (
            <div key={asset.id} className="bank-card space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{asset.label}</h3>
                  <p className="mt-1 text-[10px] text-slate-500">{TYPE_LABELS[asset.type] || asset.type}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-700">
                  {STATUS_LABELS[asset.status] || asset.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[9px] text-slate-400">القيمة السوقية</p>
                  <p className="mt-1 text-xs font-bold">{money(asset.valuation.marketValue)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[9px] text-slate-400">القيمة المؤهلة</p>
                  <p className="mt-1 text-xs font-bold">{money(asset.cappedEligibleValue)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[9px] text-slate-400">نسبة التغطية</p>
                  <p className="mt-1 text-xs font-bold">{pct(coverageOf(asset))}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">آخر تحديث: {date(asset.updatedAt)}</p>

              <details className="group/asset rounded-xl border border-slate-100">
                <summary className="bank-link flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[11px] [&::-webkit-details-marker]:hidden">
                  فتح تفاصيل الضمان
                </summary>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 text-xs">
                  <DetailLine label="رقم الضمان" value={asset.identifier || asset.id.slice(0, 8).toUpperCase()} />
                  <DetailLine label="اسم الضمان" value={asset.label} />
                  <DetailLine label="المالك" value={asset.ownerName} />
                  <DetailLine label="القيمة السوقية" value={money(asset.valuation.marketValue)} />
                  <DetailLine label="القيمة المؤهلة" value={money(asset.cappedEligibleValue)} />
                  <DetailLine label="Haircut" value={pct(asset.haircut)} />
                  <DetailLine label="نسبة التغطية" value={pct(coverageOf(asset))} />
                  <DetailLine label="الحالة" value={STATUS_LABELS[asset.status] || asset.status} />
                  <DetailLine label="تاريخ الاعتماد" value={approvalDate(asset)} />
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <div className="bank-card p-8 text-center">
          <p className="text-sm text-slate-500">لا توجد ضمانات مرتبطة بهذا الطلب.</p>
        </div>
      )}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
    </div>
  );
}
