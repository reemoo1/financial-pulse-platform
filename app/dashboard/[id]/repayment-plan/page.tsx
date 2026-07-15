import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { getReport } from "@/lib/store";
import {
  buildCompanyAlerts,
  buildRepaymentPlan,
  riskLevelLabelAr,
} from "@/lib/companyInsights";

export default async function RepaymentPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report || report.type !== "company") {
    return (
      <div className="portal-page text-center">
        <p className="portal-error">التقرير غير متاح أو لا يخص شركة قائمة.</p>
      </div>
    );
  }

  const data = report.data as import("@/lib/types").CompanyReportData;
  const plan = buildRepaymentPlan(data);
  const alerts = buildCompanyAlerts(data);

  const suitabilityTone =
    plan.suitability === "comfortable"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : plan.suitability === "stretched"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-rose-200 bg-rose-50 text-rose-900";

  const SuitabilityIcon =
    plan.suitability === "comfortable" ? CheckCircle2 : ShieldAlert;

  return (
    <div className="portal-page-wide space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="portal-kicker">خطة السداد</span>
          <h1 className="mt-4 font-heading text-2xl font-bold text-[#0F172A] md:text-3xl">
            خطة السداد الذكية
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            {data.companyName} — مبنية على التمويل المقترح وشروط السداد
          </p>
        </div>
        <Link href={`/dashboard/${id}`} className="portal-secondary-btn text-sm">
          العودة للوحة النتائج
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="مبلغ التمويل" value={formatMoney(plan.amount)} />
        <SummaryCard label="مدة السداد" value={`${plan.termMonths} شهر`} />
        <SummaryCard
          label="القسط الشهري"
          value={formatMoney(plan.monthlyInstallment)}
        />
        <SummaryCard label="نسبة الفائدة" value={`${plan.annualRate.toFixed(2)}%`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="portal-data-card p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0B1F3A]" />
            <h3 className="font-semibold">تواريخ الاستحقاق</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="أول قسط" value={formatDate(plan.firstDueDate)} />
            <MiniStat label="آخر قسط" value={formatDate(plan.lastDueDate)} />
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${suitabilityTone}`}>
          <div className="flex items-start gap-3">
            <SuitabilityIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-bold">تقييم الخطة</p>
              <h3 className="mt-1 text-lg font-bold">{plan.suitabilityLabel}</h3>
              <p className="mt-2 text-sm leading-6">{plan.suitabilityNote}</p>
              <p className="mt-3 text-xs">
                مستوى المخاطر: {riskLevelLabelAr(data.risk.riskLevel)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="portal-data-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#0B1F3A]" />
            <h3 className="font-semibold">تنبيهات مرتبطة بالخطة</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <p key={alert.id} className="text-sm text-[#475569]">
                • {alert.title}: {alert.message}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="portal-data-card overflow-hidden p-0">
        <div className="border-b border-[#E8EDF4] px-5 py-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-[#0B1F3A]" />
            <h3 className="font-semibold">جدول الأقساط الكامل</h3>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            {plan.installments.length} قسطًا — أصل + ربح
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">تاريخ الاستحقاق</th>
                <th className="p-3">الأصل</th>
                <th className="p-3">الربح</th>
                <th className="p-3">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {plan.installments.map((item) => (
                <tr key={item.sequence} className="border-t border-[#E8EDF4]">
                  <td className="p-3 font-semibold">{item.sequence}</td>
                  <td className="p-3">{formatDate(item.dueDate)}</td>
                  <td className="p-3">{formatMoney(item.principal)}</td>
                  <td className="p-3">{formatMoney(item.profit)}</td>
                  <td className="p-3 font-bold">{formatMoney(item.amountDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/${id}/performance`} className="portal-primary-btn text-sm">
          <TrendingUp className="h-4 w-4" />
          مقارنة الأداء قبل وبعد التمويل
        </Link>
        <Link href={`/financing-request/${id}`} className="portal-secondary-btn text-sm">
          تقديم طلب التمويل
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-data-card p-5 text-center">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#C9793B]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] p-3">
      <p className="text-[11px] text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-SA");
}
