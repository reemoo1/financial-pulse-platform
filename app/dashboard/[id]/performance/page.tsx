import Link from "next/link";
import { ArrowLeft, BarChart3, TrendingUp } from "lucide-react";
import { getReport } from "@/lib/store";
import PerformanceComparisonChart from "@/components/charts/PerformanceComparisonChart";

export default async function PerformancePage({
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

  return (
    <div className="portal-page-wide space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="portal-kicker">تحليل مقارن</span>
          <h1 className="mt-4 font-heading text-2xl font-bold text-[#0F172A] md:text-3xl">
            مقارنة الأداء المالي
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            قبل التمويل وبعده — {(report.data as import("@/lib/types").CompanyReportData).companyName}
          </p>
        </div>
        <Link href={`/dashboard/${id}`} className="portal-secondary-btn text-sm">
          العودة للوحة النتائج
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <section className="portal-data-card p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#0B1F3A]" />
          <div>
            <h2 className="font-semibold">المؤشرات الرئيسية</h2>
            <p className="text-xs text-[#64748B]">
              مقارنة تقديرية بين الوضع الحالي والمتوقع بعد صرف التمويل المقترح
            </p>
          </div>
        </div>
        <PerformanceComparisonChart data={report.data as import("@/lib/types").CompanyReportData} />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/${id}/repayment-plan`}
          className="portal-primary-btn text-sm"
        >
          <TrendingUp className="h-4 w-4" />
          عرض خطة السداد الذكية
        </Link>
      </div>
    </div>
  );
}
