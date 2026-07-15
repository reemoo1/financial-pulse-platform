"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Banknote,
  Sparkles,
  Loader2,
  Target,
  Clock,
  Building2,
  Landmark,
  Activity,
  Calculator,
  BarChart3,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Hash,
  ChevronDown,
  Gauge,
  ClipboardList,
  Lightbulb,
  XCircle,
  ReceiptText,
} from "lucide-react";
import RiskGauge from "@/components/RiskGauge";
import KPICard from "@/components/KPICard";
import ComparisonChart from "@/components/charts/ComparisonChart";
import Vision2030Chart from "@/components/charts/Vision2030Chart";
import ExportToolbar from "@/components/ExportToolbar";
import FinancingLifecycleCards from "@/components/FinancingLifecycleCards";
import SmartAlertsPanel from "@/components/SmartAlertsPanel";
import {
  buildCompanyAlerts,
  computeFinancingReadiness,
  deriveImprovementRecommendations,
  deriveRejectionReasons,
  riskLevelLabelAr,
} from "@/lib/companyInsights";
import {
  StoredReport,
  CompanyReportData,
  StartupReportData,
} from "@/lib/types";

export default function DashboardPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setReport(json);
      })
      .catch((e) => setError(e.message || "تعذر تحميل التقرير"));
  }, [params.id]);

  if (error) {
    return (
      <div className="portal-page text-center">
        <p className="portal-error">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="portal-loading-shell">
        <Loader2 className="w-8 h-8 animate-spin text-[#0B1F3A]" />
      </div>
    );
  }

  return (
    <div className="portal-page-wide">
      {(() => {
        const refNumber =
          report.type === "company"
            ? (report.data as CompanyReportData).referenceNumber
            : (report.data as StartupReportData).referenceNumber;
        if (!refNumber) return null;
        return (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border-[#D9E2EC] bg-[#F8FAFC] px-5 py-4 shadow-sm">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0B1F3A]/8 shrink-0">
              <Hash className="w-5 h-5 text-[#0B1F3A]" />
            </div>
            <div>
              <p className="text-xs text-fp-slate mb-0.5">
                رقم المعاملة — يُحتفظ به للاستعلام لاحقًا عن حالة الطلب
              </p>
              <p className="font-mono text-2xl font-extrabold tracking-[0.2em] text-[#C9793B]">
                {refNumber}
              </p>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">لوحة النتائج</h1>
          <p className="text-fp-slate text-sm">
            {new Date(report.createdAt).toLocaleString("ar-SA-u-ca-gregory", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportToolbar
            report={report}
            targetRef={contentRef}
            journeyHref={report.type === "company" ? `/financing-request/${params.id}` : undefined}
          />
          {report.type !== "company" && (
            <Link
              href={`/financing-request/${params.id}`}
              className="portal-primary-btn text-sm"
            >
              <Landmark className="w-4 h-4" />
              تقديم طلب تمويل
            </Link>
          )}
        </div>
      </div>

      <div ref={contentRef} className="space-y-6">
        {report.type === "company" ? (
          <CompanyDashboard
            data={report.data as CompanyReportData}
            reportId={params.id}
          />
        ) : (
          <StartupDashboard data={report.data as StartupReportData} />
        )}
      </div>
    </div>
  );
}

function CompanyDashboard({
  data,
  reportId,
}: {
  data: CompanyReportData;
  reportId: string;
}) {
  const companyComparisonInput = {
    liquidityRatio: data.ratios.currentRatio ?? 0,
    debtRatio: data.ratios.debtRatio ?? 0,
    profitMargin: data.ratios.netProfitMargin ?? 0,
  };

  const warnings = data.elt?.logicValidation?.warnings || [];
  const hasFundingRecommendation = data.funding.amount > 0;
  const hasDataSufficiencyWarning = Boolean(
    data.dataSufficiency &&
    (data.dataSufficiency.supplemental.missingFields.length > 0 ||
      data.dataSufficiency.vision2030.isEstimated ||
      !data.dataSufficiency.altman.isAccurate),
  );
  const headline = getNarrativeHeadline(
    data.narrative,
    `تعكس النتائج مستوى مخاطر ${riskLevelLabel(data.risk.riskLevel)} ودرجة صحة مالية تبلغ ${data.risk.healthScore ?? 100 - data.risk.defaultProbability}%.`,
  );
  const readiness = computeFinancingReadiness(data);
  const rejectionReasons = deriveRejectionReasons(data);
  const recommendations = deriveImprovementRecommendations(data);
  const smartAlerts = buildCompanyAlerts(data);

  return (
    <>
      {/* الطبقة الأولى: النتيجة التي يحتاجها صاحب الشركة خلال أول ثوانٍ */}
      <section className="overflow-hidden rounded-3xl border border-[#D9E2EC] bg-white">
        <div className="bg-gradient-to-b from-[#F8FAFC] to-white px-5 py-7 sm:px-8 sm:py-9">
          <div className="mb-3 flex items-center justify-center gap-2 text-center">
            <Building2 className="h-5 w-5 text-[#0B1F3A]" />
            <h2 className="font-heading text-xl font-bold sm:text-2xl">
              {data.companyName}
            </h2>
          </div>
          <p className="mb-5 text-center text-sm text-fp-slate">
            {data.sector} · {data.city || "غير محدد"}
          </p>

          <div className="flex justify-center">
            <RiskGauge
              value={
                data.risk.healthScore ?? 100 - data.risk.defaultProbability
              }
              riskLevel={data.risk.riskLevel}
              label="درجة الصحة المالية"
              suffix="%"
            />
          </div>

          <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
            <PrimaryResultCard
              label="التمويل الموصى به"
              value={
                hasFundingRecommendation
                  ? formatMoney(data.funding.amount)
                  : "غير متاح آليًا"
              }
              note={
                hasFundingRecommendation
                  ? data.funding.isPreliminary
                    ? "تقدير أولي متحفظ؛ يثبت بعد اكتمال DSCR ومراجعة البنك"
                    : "وفق أقل حد آمن للقدرة التمويلية"
                  : "لا توجد قدرة تمويلية موجبة من البيانات الحالية"
              }
            />
            <PrimaryResultCard
              label="نسبة الفائدة التقديرية"
              value={`${formatNumber(data.funding.interestRate, 2)}%`}
              note="سعر مرجعي مضافًا إليه علاوة المخاطر"
            />
            <PrimaryResultCard
              label="قيمة الضمان المطلوبة تقديريًا"
              value={
                hasFundingRecommendation
                  ? formatMoney(data.funding.collateral?.requiredEligibleValue)
                  : "غير متاحة"
              }
              note={
                hasFundingRecommendation
                  ? `تغطية ${formatNumber((data.funding.collateral?.requiredCoverageRatio ?? 0) * 100, 0)}% من مبلغ التمويل قبل التقييم المستقل`
                  : "تظهر بعد احتساب مبلغ تمويل موجب"
              }
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          icon={Gauge}
          label="نسبة جاهزية التمويل"
          value={`${readiness.readinessScore}%`}
          trend={readiness.readinessScore >= 70 ? "up" : readiness.readinessScore >= 45 ? "neutral" : "down"}
          trendHint="مؤشر مركب للجاهزية"
        />
        <KPICard
          icon={Banknote}
          label="مبلغ التمويل المقترح"
          value={hasFundingRecommendation ? formatMoney(readiness.suggestedAmount) : "غير متاح"}
          unavailable={!hasFundingRecommendation}
        />
        <KPICard
          icon={Target}
          label="نسبة القدرة على السداد"
          value={`${readiness.repaymentCapacity}%`}
          trend={readiness.repaymentCapacity >= 100 ? "up" : readiness.repaymentCapacity >= 75 ? "neutral" : "down"}
          trendHint="مقابل القسط الشهري التقديري"
        />
        <KPICard
          icon={ShieldCheck}
          label="مستوى المخاطر"
          value={riskLevelLabelAr(data.risk.riskLevel)}
          trend={data.risk.riskLevel === "low" ? "up" : data.risk.riskLevel === "high" ? "down" : "neutral"}
        />
        <KPICard
          icon={ClipboardList}
          label="حالة الطلب"
          value={readiness.requestStatus}
          trend={readiness.requestStatusCode === "ready" ? "up" : readiness.requestStatusCode === "not_ready" ? "down" : "neutral"}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/${reportId}/repayment-plan`} className="portal-primary-btn text-sm">
          <ReceiptText className="h-4 w-4" />
          خطة السداد الذكية
        </Link>
        <Link href={`/dashboard/${reportId}/performance`} className="portal-secondary-btn text-sm">
          <BarChart3 className="h-4 w-4" />
          مقارنة الأداء المالي
        </Link>
      </div>

      <SmartAlertsPanel alerts={smartAlerts} />

      {rejectionReasons.length > 0 && (
        <section className="portal-data-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="portal-icon-box h-9 w-9">
              <XCircle className="h-5 w-5 text-rose-700" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0F172A]">أسباب رفض الطلب المحتملة</h3>
              <p className="text-xs text-[#64748B]">
                عوامل قد تؤدي لرفض أو تأجيل التمويل وفق التحليل الحالي
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {rejectionReasons.map((item) => (
              <div
                key={item.reason}
                className={`rounded-xl border p-4 text-sm leading-6 ${
                  item.severity === "high"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {item.reason}
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="portal-data-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="portal-icon-box h-9 w-9">
              <Lightbulb className="h-5 w-5 text-[#C9793B]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0F172A]">
                توصيات لتحسين فرص التمويل
              </h3>
              <p className="text-xs text-[#64748B]">
                خطوات عملية لرفع أهلية الشركة قبل تقديم الطلب
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#0F172A]">{item.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.priority === "high"
                        ? "bg-rose-50 text-rose-700"
                        : item.priority === "medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-[#E8EDF4] text-[#64748B]"
                    }`}
                  >
                    {item.priority === "high" ? "أولوية عالية" : item.priority === "medium" ? "متوسطة" : "مقترحة"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* تنبيه المصداقية يبقى ظاهرًا، وتفاصيله تُفتح عند الحاجة */}
      {hasDataSufficiencyWarning && data.dataSufficiency && (
        <details className="group rounded-2xl border border-amber-200 bg-amber-50">
          <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h3 className="font-semibold text-amber-950">
                  دقة التحليل واكتمال البيانات
                </h3>
                <p className="mt-1 text-sm text-amber-900">
                  تم احتساب بعض النتائج كتقديرات أو إظهارها كغير متاحة بسبب نقص
                  بيانات إضافية.
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-800">
              ماذا يعني هذا؟
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-3 border-t border-amber-200 px-5 py-4 text-sm text-amber-900">
            <p>
              الحقول المالية الأساسية الـ23 مكتملة وإلزامية. النتائج التي تعتمد
              على حقول إضافية غير مدخلة لا تُعرض كحقائق مؤكدة.
            </p>
            {data.dataSufficiency.supplemental.missingFields.length > 0 && (
              <div>
                <p className="font-medium">بيانات مصرفية إضافية غير متوفرة:</p>
                <p>
                  {data.dataSufficiency.supplemental.missingFields.join("، ")}
                </p>
              </div>
            )}
            {data.dataSufficiency.vision2030.isEstimated && (
              <div>
                <p className="font-medium">رؤية 2030: تحليل تقديري</p>
                <p>{data.dataSufficiency.vision2030.note}</p>
              </div>
            )}
            {!data.dataSufficiency.altman.isAccurate && (
              <div>
                <p className="font-medium">Altman Z&apos;: غير متاح بدقة</p>
                <p>{data.dataSufficiency.altman.note}</p>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="rounded-2xl border border-[#D9E2EC] bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0B1F3A]" />
          <div>
            <h3 className="font-semibold">تم التحقق من البيانات الأساسية</h3>
            <p className="mt-1 text-sm text-fp-slate">
              {data.elt?.message ||
                "تم تنظيف البيانات واستخراج المؤشرات المالية قبل إنشاء الداشبورد."}
            </p>
            {warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {warnings.map((warning) => (
                  <li key={warning}>· {warning}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* الطبقة الثانية: المؤشرات الداعمة والرسوم */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          icon={Wallet}
          label="نسبة السيولة الحالية"
          value={formatTimes(data.ratios.currentRatio)}
          trend={trendVsBenchmark(
            data.ratios.currentRatio,
            data.benchmark.liquidityRatio,
            false,
          )}
          trendHint="مقابل متوسط القطاع"
        />
        <KPICard
          icon={TrendingDown}
          label="نسبة المديونية"
          value={formatPercent(data.ratios.debtRatio)}
          trend={trendVsBenchmark(
            data.ratios.debtRatio,
            data.benchmark.debtRatio,
            true,
          )}
          trendHint="مقابل متوسط القطاع"
        />
        <KPICard
          icon={TrendingUp}
          label="هامش صافي الربح"
          value={formatPercent(data.ratios.netProfitMargin)}
          trend={trendVsBenchmark(
            data.ratios.netProfitMargin,
            data.benchmark.profitMargin,
            false,
          )}
          trendHint="مقابل متوسط القطاع"
        />
        <KPICard
          icon={Banknote}
          label="التدفق التشغيلي إلى الالتزامات"
          value={formatPercent(data.ratios.operatingCashFlowRatio)}
          trend={trendVsThreshold(data.ratios.operatingCashFlowRatio, 0.4, 0.2)}
          trendHint="مرجع: 40% فأعلى جيد"
        />
        <KPICard
          icon={ShieldCheck}
          label="DSCR"
          value={formatTimes(data.ratios.dscr)}
          trend={trendVsThreshold(data.ratios.dscr, 1.25, 1)}
          trendHint={
            data.ratios.dscr === null
              ? "غير متاح لعدم اكتمال CFADS وجدول خدمة الدين"
              : "مرجع: 1.25 مرة فأعلى مريح"
          }
          unavailable={data.ratios.dscr === null}
        />
        <KPICard
          icon={Activity}
          label="Altman Z'-Score"
          value={
            data.ratios.zScore === null
              ? "غير متاح"
              : formatNumber(data.ratios.zScore, 2)
          }
          trend={trendVsThreshold(data.ratios.zScore, 2.9, 1.23)}
          trendHint={
            data.ratios.zScore === null
              ? "نقص بيانات، وليس نتيجة مخاطر سلبية"
              : "آمن فوق 2.9 · خطر تحت 1.23"
          }
          unavailable={data.ratios.zScore === null}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="portal-data-card p-6">
          <h3 className="mb-4 font-semibold">مقارنة مع متوسط القطاع</h3>
          <ComparisonChart
            company={companyComparisonInput}
            benchmark={data.benchmark}
          />
        </div>
        <div className="portal-data-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">تفصيل توافق رؤية 2030</h3>{data.dataSufficiency?.vision2030?.isEstimated && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">افتراضي لعدم توفر بيانات كافية</span>}</div>
          <Vision2030Chart breakdown={data.vision2030.breakdown} />
        </div>
      </div>

      {data.financingLifecycle && (
        <FinancingLifecycleCards
          lifecycle={data.financingLifecycle}
          title="رحلة التمويل المقترحة بعد التحليل"
        />
      )}

      {/* الطبقة الثالثة: التفاصيل الفنية للمتخصصين */}
      <details className="group rounded-2xl border border-[#D9E2EC] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0B1F3A]" />
            <div>
              <h3 className="font-semibold">كيف حسبنا هذه النتيجة؟</h3>
              <p className="mt-1 text-sm text-fp-slate">
                المنهجية، الأوزان، النسب التفصيلية، وافتراضات التمويل.
              </p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-fp-slate transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-8 border-t border-[#E8EDF4] px-5 py-6 sm:px-6">
          <details className="group/inner rounded-xl border border-[#D9E2EC]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0B1F3A]" />
                <h4 className="font-semibold">منهجية الصحة المالية</h4>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-fp-slate transition-transform group-open/inner:rotate-180" />
            </summary>
            <div className="border-t border-[#E8EDF4] px-4 pb-4 pt-4">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Stat
                  label="درجة الصحة المالية"
                  value={`${data.risk.healthScore ?? "-"}%`}
                />
                <Stat
                  label="احتمال التعثر التقديري 12 شهرًا"
                  value={`${formatNumber(data.risk.defaultProbability, 1)}%`}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {(data.risk.components || []).map((component) => (
                  <div
                    key={component.key}
                    className="rounded-xl bg-[#F8FAFC] px-4 py-3"
                  >
                    <p className="text-xs text-fp-slate">{component.label}</p>
                    <p className="mt-1 text-lg font-bold">
                      {component.available === false
                        ? "غير متاح"
                        : `${component.score}%`}
                    </p>
                    <p className="mt-1 text-[11px] text-fp-slate">
                      الوزن {formatNumber(component.weight * 100, 0)}% · المساهمة{" "}
                      {formatNumber(component.contribution, 1)}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-fp-slate">
                      {component.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <section>
            <h4 className="mb-4 font-semibold">
              النسب والقيم المالية التفصيلية
            </h4>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MetricSection
                icon={Wallet}
                title="السيولة ورأس المال العامل"
                rows={[
                  [
                    "نسبة السيولة الحالية",
                    formatTimes(data.ratios.currentRatio),
                  ],
                  ["نسبة السيولة السريعة", formatTimes(data.ratios.quickRatio)],
                  ["نسبة النقد", formatTimes(data.ratios.cashRatio)],
                  ["رأس المال العامل", formatMoney(data.ratios.workingCapital)],
                ]}
              />
              <MetricSection
                icon={TrendingDown}
                title="المديونية والملاءة"
                rows={[
                  ["نسبة المديونية", formatPercent(data.ratios.debtRatio)],
                  [
                    "الدين إلى حقوق الملكية",
                    formatTimes(data.ratios.debtToEquity),
                  ],
                  ["نسبة حقوق الملكية", formatPercent(data.ratios.equityRatio)],
                  ["تغطية الفوائد", formatTimes(data.ratios.interestCoverage)],
                ]}
              />
              <MetricSection
                icon={TrendingUp}
                title="الربحية والكفاءة"
                rows={[
                  [
                    "هامش مجمل الربح",
                    formatPercent(data.ratios.grossProfitMargin),
                  ],
                  [
                    "الهامش التشغيلي",
                    formatPercent(data.ratios.operatingMargin),
                  ],
                  [
                    "هامش صافي الربح",
                    formatPercent(data.ratios.netProfitMargin),
                  ],
                  ["العائد على الأصول ROA", formatPercent(data.ratios.roa)],
                  [
                    "العائد على حقوق الملكية ROE",
                    formatPercent(data.ratios.roe),
                  ],
                  ["دوران الأصول", formatTimes(data.ratios.assetTurnover)],
                ]}
              />
              <MetricSection
                icon={Banknote}
                title="التدفقات النقدية والمخاطر"
                rows={[
                  [
                    "التدفق التشغيلي إلى الالتزامات المتداولة",
                    formatPercent(data.ratios.operatingCashFlowRatio),
                  ],
                  [
                    "التدفق التشغيلي إلى إجمالي الالتزامات",
                    formatPercent(data.ratios.operatingCashFlowToDebt),
                  ],
                  ["التدفق النقدي الحر", formatMoney(data.ratios.freeCashFlow)],
                  ["DSCR", formatTimes(data.ratios.dscr)],
                  [
                    "Altman Z'-Score",
                    `${formatNumberOrNA(data.ratios.zScore, 2)}${formatAltmanModel(data.ratios.altmanModel)}`,
                  ],
                ]}
              />
            </div>
          </section>

          <section>
            <div className="rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC]/50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#0B1F3A]" />
                <h4 className="font-semibold">حسابات التمويل الموصى به</h4>
              </div>
              {data.funding.isPreliminary && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                  هذا حد تمويلي أولي متحفظ مبني على الأصول والمديونية
                  والإيرادات. لا يمثل موافقة نهائية، ويعاد احتسابه بعد إدخال
                  CFADS وجدول خدمة الدين.
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label={
                    data.funding.isPreliminary
                      ? "المبلغ التقديري الأولي"
                      : "المبلغ المقترح"
                  }
                  value={formatMoney(data.funding.amount)}
                />
                <Stat
                  label="الضمان المؤهل المطلوب"
                  value={formatMoney(
                    data.funding.collateral?.requiredEligibleValue,
                  )}
                />
                <Stat
                  label="نسبة تغطية الضمان"
                  value={`${formatNumber((data.funding.collateral?.requiredCoverageRatio ?? 0) * 100, 0)}%`}
                />
                <Stat
                  label="المدة المقترحة"
                  value={`${data.funding.recommendedTermMonths || "-"} شهر`}
                />
                <Stat
                  label="القسط الشهري التقديري"
                  value={formatMoney(data.funding.estimatedMonthlyInstallment)}
                />
                <Stat
                  label="DSCR بعد التمويل"
                  value={formatTimes(data.funding.dscrAfterFinancing)}
                />
                <Stat
                  label="أقصى قسط مريح"
                  value={formatMoney(data.funding.maxAffordableInstallment)}
                />
                <Stat
                  label="تصنيف الأهلية"
                  value={fundingEligibilityLabel(data.funding.eligibility)}
                />
                <Stat
                  label="سعر الفائدة المقترح"
                  value={`${formatNumber(data.funding.interestRate, 2)}%`}
                />
                <Stat
                  label="منهجية الحساب"
                  value={data.funding.basis || "حسب المؤشرات المالية المعالجة"}
                  small
                />
              </div>
              {data.funding.calculation && (
                <div className="mt-4 border-t border-[#E8EDF4] pt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <Stat
                      label="حد التدفق النقدي"
                      value={formatMoney(
                        data.funding.calculation.cashFlowCapacity,
                      )}
                    />
                    <Stat
                      label="حد صافي الأصول"
                      value={formatMoney(
                        data.funding.calculation.assetBackedCapacity,
                      )}
                    />
                    <Stat
                      label="حد المديونية"
                      value={formatMoney(
                        data.funding.calculation.leverageCapacity,
                      )}
                    />
                    <Stat
                      label="حد الإيرادات"
                      value={formatMoney(
                        data.funding.calculation.revenueCapacity,
                      )}
                    />
                    <Stat
                      label="القيد الحاكم"
                      value={data.funding.calculation.bindingConstraint}
                    />
                    <Stat
                      label="اكتمال بيانات خدمة الدين"
                      value={
                        data.funding.calculation.debtServiceDataComplete
                          ? "مكتملة"
                          : "غير مكتملة — التقدير أولي ويحتاج مراجعة"
                      }
                    />
                    <Stat
                      label="CFADS"
                      value={formatMoney(data.funding.calculation.cfads)}
                    />
                    <Stat
                      label="DSCR المستهدف"
                      value={`${formatNumber(data.funding.calculation.targetDscr, 2)} مرة`}
                    />
                    <Stat
                      label="خدمة الدين التعاقدية للفترة"
                      value={formatMoney(
                        data.funding.calculation.existingAnnualDebtService,
                      )}
                    />
                    <Stat
                      label="مرجع السعر + علاوة المخاطر"
                      value={`${formatNumber(data.funding.calculation.policyReferenceRate, 2)}% + ${formatNumber(data.funding.calculation.riskPremium, 2)}%`}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#C9793B]/20 bg-[#C9793B]/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#C9793B]" />
              <h4 className="font-semibold">ملخص الذكاء الاصطناعي الكامل</h4>
            </div>
            <p className="text-sm leading-relaxed text-fp-slate">
              {data.narrative}
            </p>
          </section>
        </div>
      </details>
    </>
  );
}

function StartupDashboard({ data }: { data: StartupReportData }) {
  const riskLevel =
    data.successProbability >= 65
      ? "low"
      : data.successProbability >= 45
        ? "medium"
        : "high";

  return (
    <>
      <div className="portal-data-card flex flex-col md:flex-row items-center gap-8 p-6">
        <RiskGauge
          value={data.successProbability}
          riskLevel={riskLevel}
          label="نسبة النجاح المتوقعة"
        />
        <div className="flex-1 w-full">
          <h2 className="font-heading text-xl font-bold mb-1">
            {data.input.projectName}
          </h2>
          <p className="text-sm text-fp-slate mb-4">
            {data.input.sector} · {data.input.city || "غير محدد"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="توافق رؤية 2030" value={`${data.vision2030.score}%`} />
            <Stat
              label="رأس المال الموصى به"
              value={`${data.recommendedCapital.toLocaleString("ar-SA")} ريال`}
            />
            <Stat
              label="التمويل المطلوب"
              value={`${data.fundingNeeded.toLocaleString("ar-SA")} ريال`}
            />
            <Stat label="مدة الاسترداد" value={`${data.paybackMonths} شهر`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="portal-data-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">تفصيل توافق رؤية 2030</h3>{data.vision2030.details?.isEstimated && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">افتراضي لعدم توفر بيانات كافية</span>}</div>
          <Vision2030Chart breakdown={data.vision2030.breakdown} />
        </div>

        <div className="portal-data-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-[#0B1F3A]" />
            <h3 className="font-semibold">أفضل الجهات التمويلية</h3>
          </div>
          <ul className="space-y-2">
            {data.fundingSources.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9793B]" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="portal-data-card p-6">
        <h3 className="font-semibold mb-4">تقييم SWOT</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SwotBox
            title="نقاط القوة"
            items={data.swot.strengths}
            colorClass="text-emerald-700"
          />
          <SwotBox
            title="نقاط الضعف"
            items={data.swot.weaknesses}
            colorClass="text-rose-600"
          />
          <SwotBox
            title="الفرص"
            items={data.swot.opportunities}
            colorClass="text-[#0B1F3A]"
          />
          <SwotBox
            title="التهديدات"
            items={data.swot.threats}
            colorClass="text-amber-700"
          />
        </div>
      </div>

      <div className="portal-data-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#0B1F3A]" />
          <h3 className="font-semibold">خطة تطوير المشروع</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.roadmap.map((phase) => (
            <div
              key={phase.title}
              className="border border-[#D9E2EC] rounded-xl p-4"
            >
              <p className="text-xs text-[#C9793B] font-semibold mb-1">
                {phase.timeframe}
              </p>
              <h4 className="font-semibold mb-2">{phase.title}</h4>
              <ul className="space-y-1.5 text-sm text-fp-slate">
                {phase.items.map((it) => (
                  <li key={it}>· {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="portal-data-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-[#C9793B]" />
          <h3 className="font-semibold">ملخص الذكاء الاصطناعي</h3>
        </div>
        <p className="text-sm leading-relaxed text-fp-slate">
          {data.narrative}
        </p>
      </div>
    </>
  );
}

function PrimaryResultCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] bg-white p-5 text-center shadow-sm">
      <p className="text-xs font-medium text-fp-slate">{label}</p>
      <p className="mt-2 font-heading text-2xl font-extrabold tabular-nums text-[#C9793B]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fp-slate">{note}</p>
    </div>
  );
}

function MetricSection({
  icon: Icon,
  title,
  rows,
}: {
  icon: typeof BarChart3;
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="portal-data-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-[#0B1F3A]" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-[#E8EDF4] pb-2 last:border-0 last:pb-0 text-sm"
          >
            <span className="text-fp-slate">{label}</span>
            <span className="font-semibold text-left">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-[#F8FAFC] rounded-lg px-3 py-2.5">
      <p className="text-xs text-fp-slate mb-0.5">{label}</p>
      <p
        className={
          small ? "text-sm font-semibold leading-relaxed" : "font-bold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function SwotBox({
  title,
  items,
  colorClass,
}: {
  title: string;
  items: string[];
  colorClass: string;
}) {
  return (
    <div className="border border-[#D9E2EC] rounded-xl p-4">
      <h4 className={`font-semibold mb-2 ${colorClass}`}>{title}</h4>
      <ul className="space-y-1.5 text-sm text-fp-slate">
        {items.map((it) => (
          <li key={it}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}

function getNarrativeHeadline(narrative: string, fallback: string) {
  const cleaned = narrative?.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  const sentence = cleaned.match(/^.*?[.!؟](?:\s|$)/)?.[0]?.trim();
  return sentence || cleaned;
}

function riskLevelLabel(level: CompanyReportData["risk"]["riskLevel"]) {
  if (level === "low") return "منخفض";
  if (level === "medium") return "متوسط";
  return "مرتفع";
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "غير متوفر";
  return value.toLocaleString("ar-SA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatNumberOrNA(value: number | null | undefined, digits = 2) {
  return formatNumber(value, digits);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "غير متوفر";
  return `${(value * 100).toLocaleString("ar-SA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatTimes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "غير متوفر";
  return `${value.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} مرة`;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "غير متوفر";
  return `${Math.round(value).toLocaleString("ar-SA")} ريال`;
}

function formatAltmanModel(model: string | null | undefined) {
  if (!model) return "";
  if (model === "private_full") return " (نموذج الشركات الخاصة – كامل)";
  if (model === "unavailable")
    return " (غير متاح: الأرباح المبقاة أو مدخلات النموذج ناقصة)";
  return ` (${model})`;
}

// up = أفضل من المرجع، down = أضعف منه، مع منطقة محايدة اختيارية
function trendVsBenchmark(
  value: number | null | undefined,
  benchmark: number | null | undefined,
  lowerIsBetter: boolean,
): "up" | "down" | "neutral" {
  if (
    value === null ||
    value === undefined ||
    benchmark === null ||
    benchmark === undefined ||
    !Number.isFinite(value)
  )
    return "neutral";
  const better = lowerIsBetter ? value <= benchmark : value >= benchmark;
  return better ? "up" : "down";
}

function trendVsThreshold(
  value: number | null | undefined,
  goodAtOrAbove: number,
  badBelow: number,
): "up" | "down" | "neutral" {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "neutral";
  if (value >= goodAtOrAbove) return "up";
  if (value < badBelow) return "down";
  return "neutral";
}

function visionSourceLabel(source?: "actual" | "estimated") {
  return source === "actual" ? "بيانات فعلية" : "تقدير معلن";
}

function fundingEligibilityLabel(
  value: CompanyReportData["funding"]["eligibility"],
) {
  if (value === "eligible") return "مؤهل";
  if (value === "conditional") return "مشروط";
  if (value === "committee_review") return "لجنة ائتمان";
  return "غير محدد";
}
