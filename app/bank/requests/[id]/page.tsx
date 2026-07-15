export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Gavel,
  Landmark,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deriveRequestProfile } from "@/lib/bankPortfolio";
import { buildAiCreditRecommendation } from "@/lib/creditAi";
import { collateralContextFromRequest, isCollateralReadyForDisbursement, requiredCollateralCoverageRatio } from "@/lib/collateral";
import { getFinancingRequest, getReport } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import { date, money, pct, RiskBadge, StatusBadge } from "@/components/bank/BankUI";
import EditableFinancingCalculation from "@/components/bank/EditableFinancingCalculation";
import BankAnalysisCharts from "@/components/bank/BankAnalysisCharts";
import {
  BankRiskScorePanel,
  BankSuggestedFinancingPanel,
  BankSystemDecisionPanel,
} from "@/components/bank/BankRequestInsights";
import { CompanyReportData } from "@/lib/types";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const { id } = await params;
  const request = await getFinancingRequest(id);
  if (!request) notFound();
  const report = await getReport(request.data.input.reportId);
  const profile = deriveRequestProfile(request, report);
  const company = profile.company;
  const startup = profile.startup;
  const baseSuggestedAmount = company?.funding.amount || startup?.recommendedCapital || request.data.input.requestedAmount;
  const baseSuggestedRate = company?.funding.interestRate || request.data.bankQuote.estimatedRate;
  const suggestedAmount = request.data.creditReview?.calculationOverrides?.analystRecommendedAmount || request.data.creditReview?.recommendedAmount || baseSuggestedAmount;
  const suggestedRate = request.data.creditReview?.calculationOverrides?.analystRecommendedRate || request.data.creditReview?.recommendedRate || baseSuggestedRate;
  const policyContext = {
    ...collateralContextFromRequest(request.data, report?.data || null),
    approvedFinancingAmount: suggestedAmount,
  };
  const policyCoverageRatio = request.data.creditReview?.calculationOverrides?.requiredCollateralCoveragePercent != null
    ? request.data.creditReview.calculationOverrides.requiredCollateralCoveragePercent / 100
    : request.data.collateral?.requiredCoverageRatio ?? requiredCollateralCoverageRatio(policyContext);
  const aiRecommendation = buildAiCreditRecommendation({
    applicantName: request.data.applicantName,
    requestedAmount: request.data.input.requestedAmount,
    requestedTermMonths: request.data.input.termMonths,
    collateralReady: isCollateralReadyForDisbursement(request.data),
    earlyWarningScore: profile.warning,
    company,
    startup,
  });

  return (
    <BankShell
      user={session}
      title={`ملف ائتماني — ${request.data.applicantName}`}
      subtitle={`طلب ${request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()} · آخر تحديث ${date(request.data.metadata?.lastUpdate)}`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/bank/requests" className="bank-link inline-flex items-center gap-2 text-xs text-slate-500"><ArrowRight className="h-4 w-4" />العودة إلى الطلبات</Link>
          <div className="flex flex-wrap gap-2"><RiskBadge risk={profile.risk} /><StatusBadge status={request.data.status} /></div>
        </div>

        <section className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white lg:p-8">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#C9793B]/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10"><Building2 className="h-7 w-7 text-[#C9793B]" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">{request.data.applicantName}</h2><span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[10px]">{request.data.applicantType === "company" ? "شركة قائمة" : "منشأة ناشئة"}</span></div>
                <p className="mt-2 text-sm text-slate-300">{request.data.sector} · {request.data.companyProfile?.detailedActivity ? `النشاط: ${request.data.companyProfile.detailedActivity}` : "وصف النشاط غير متوفر"} · طلب تمويل بقيمة {money(request.data.input.requestedAmount)}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-400"><span>السجل التجاري: {request.data.companyProfile?.crNumber || "غير مسجل"}</span><span>المالك/المفوض: {request.data.input.ownerName || "غير مسجل"}</span><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{request.data.input.contactName}</span><span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{request.data.input.phone}</span>{request.data.input.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{request.data.input.email}</span>}</div>
              </div>
            </div>
            <div className="grid min-w-[330px] grid-cols-3 gap-3"><HeroMetric label="الصحة المالية" value={`${profile.health.toFixed(0)}%`} /><HeroMetric label="PD خلال 12 شهر" value={`${profile.pd.toFixed(1)}%`} /><HeroMetric label="التمويل المقترح" value={money(suggestedAmount, true)} /></div>
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label="المبلغ المطلوب" value={money(request.data.input.requestedAmount)} icon={WalletCards} />
              <Kpi label="المدة المطلوبة" value={`${request.data.input.termMonths} شهر`} icon={CalendarDays} />
              <Kpi label="الفائدة المحسوبة" value={`${suggestedRate.toFixed(2)}%`} icon={Landmark} />
            </section>

            <BankRiskScorePanel
              profile={profile}
              company={company}
              aiRecommendation={aiRecommendation}
            />
            <BankSystemDecisionPanel aiRecommendation={aiRecommendation} />
            <BankSuggestedFinancingPanel
              suggestedAmount={suggestedAmount}
              suggestedRate={suggestedRate}
              suggestedTerm={request.data.creditReview?.calculationOverrides?.termMonthsOverride || request.data.input.termMonths}
              profile={profile}
              aiRecommendation={aiRecommendation}
            />

            {company ? <>
              <EditableFinancingCalculation
                requestId={request.id}
                requestedAmount={request.data.input.requestedAmount}
                requestedTerm={request.data.creditReview?.calculationOverrides?.termMonthsOverride || request.data.input.termMonths}
                currentDebtRatio={company.ratios.debtRatio}
                policyCoveragePercent={policyCoverageRatio * 100}
                funding={company.funding}
                overrides={request.data.creditReview?.calculationOverrides}
              />
              <BankAnalysisCharts company={company} health={profile.health} probabilityOfDefault={profile.pd} />
            </> : (
              <section className="bank-card p-6"><div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-[#0B1F3A]" /><h2 className="font-bold">كيف حُسب التمويل المقترح؟</h2></div><p className="mt-4 text-sm leading-7 text-slate-700">للمنشأة الناشئة يعتمد الحد على رأس المال المقترح، الاحتياج التمويلي، احتمال النجاح، وفترة الاسترداد المقدرة. المبلغ المقترح هو {money(startup?.recommendedCapital || suggestedAmount)} وفترة الاسترداد {startup?.paybackMonths || request.data.input.termMonths} شهر.</p></section>
            )}

            <section className="bank-card p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">ملخص الذكاء الائتماني</h2><p className="mt-1 text-xs text-slate-500">تفسير للنتائج المحسوبة، وليس قرارًا مستقلًا عن الموظف</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Bot className="h-5 w-5" /></div></div>
              <p className="mt-5 text-sm leading-7 text-slate-700">{company?.narrative || startup?.narrative || `تم تحليل طلب ${request.data.applicantName} وترتيب المخاطر وفق البيانات المتاحة.`}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-1"><Insight tone="good" title="نقطة القوة" text={strengthText(company)} /></div>
            </section>

            <section className="bank-card overflow-hidden">
              <div className="border-b border-slate-100 p-5"><h2 className="font-bold">توصية AI للشروط والمخاطر</h2><p className="mt-1 text-xs text-slate-500">مبنية على المحرك المالي والبيانات الموجودة في الطلب</p></div>
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4"><div className="flex items-center gap-2 text-[#0B1F3A]"><ClipboardCheck className="h-4 w-4" /><p className="text-xs font-bold">الشروط المقترحة</p></div><ul className="mt-3 space-y-2">{aiRecommendation.conditions.map((item, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-slate-700"><span className="text-[#C9793B]">•</span>{item}</li>)}</ul></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-amber-700"><Gauge className="h-4 w-4" /><p className="text-xs font-bold">رأي المخاطر</p></div><p className="mt-3 text-xs leading-6 text-slate-700">{aiRecommendation.riskRecommendation}</p>{aiRecommendation.warnings.length > 0 && <div className="mt-3 border-t border-amber-200 pt-3">{aiRecommendation.warnings.map((item, index) => <p key={index} className="mt-1 text-[10px] leading-5 text-slate-600">• {item}</p>)}</div>}</div>
              </div>
            </section>

            {company && <FinancialMetrics company={company} />}

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="bank-card p-5"><div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-[#0B1F3A]" /><div><h2 className="font-bold">المستندات الأساسية</h2><p className="mt-1 text-[10px] text-slate-500">القوائم، كشف 6 أشهر، السجل التجاري، وهوية المفوض</p></div></div><div className="space-y-2"><DocumentStatus label="القوائم المالية" complete={Boolean(report)} detail="موجودة في تقرير التحليل المالي" />{request.data.uploadedFiles?.length ? request.data.uploadedFiles.map((file) => <a key={file.id} href={`/api/bank/requests/${request.id}/files/${file.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-[#C9793B]/40 hover:bg-[#F8FAFC]"><div className="bank-icon-box h-9 w-9"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold">{file.displayLabel || file.originalName}</p>{file.required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[8px] font-bold text-rose-700">إلزامي</span>}</div><p className="mt-1 text-[10px] text-slate-400">{file.originalName} · {(file.size / 1024).toFixed(1)} KB · {date(file.uploadedAt)}</p></div><span className="bank-link text-[9px]">فتح</span></a>) : <p className="text-xs text-slate-500">لا توجد مرفقات.</p>}</div></div>
              <div className="bank-card p-5"><div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#0B1F3A]" /><h2 className="font-bold">بيانات الطلب والغرض</h2></div><div className="grid gap-3 sm:grid-cols-2"><InfoLine label="السجل التجاري" value={request.data.input.crNumber || "غير مسجل"} /><InfoLine label="هوية المالك/المفوض" value={request.data.input.ownerNationalId ? `${request.data.input.ownerNationalId.slice(0, 2)}******${request.data.input.ownerNationalId.slice(-2)}` : "غير مسجلة"} /></div><p className="mt-5 text-xs text-slate-500">الغرض</p><p className="mt-2 text-sm font-semibold leading-6">{request.data.input.purpose || "غير محدد"}</p><p className="mt-5 text-xs text-slate-500">الملاحظات</p><p className="mt-2 text-sm leading-6 text-slate-700">{request.data.input.notes || "لا توجد ملاحظات إضافية."}</p></div>
            </section>
          </div>

          <div className="space-y-4 xl:sticky xl:top-28">
            <RequestNavCard
              href={`/bank/requests/${request.id}/credit-decision`}
              icon={Gavel}
              title="قرار الائتمان"
              status={<StatusBadge status={request.data.status} />}
            />
            <RequestNavCard
              href={`/bank/requests/${request.id}/collateral`}
              icon={ShieldCheck}
              title="الضمانات"
              status={request.data.collateral ? `${money(request.data.collateral.currentEligibleValue, true)} معتمد` : "لا يوجد ضمان بعد"}
            />
            <RequestNavCard
              href={`/bank/requests/${request.id}/monitoring`}
              icon={ReceiptText}
              title="المتابعة الشهرية"
              status={`${request.data.operations?.installments?.length || 0} دفعة`}
            />
          </div>
        </div>
      </div>
    </BankShell>
  );
}

function RequestNavCard({
  href,
  icon: Icon,
  title,
  status,
}: {
  href: string;
  icon: typeof Gavel;
  title: string;
  status: React.ReactNode;
}) {
  return (
    <Link href={href} className="bank-card group flex items-center justify-between gap-3 p-5 transition hover:border-[#C9793B]/40">
      <div className="flex items-center gap-3">
        <div className="bank-icon-box h-11 w-11"><Icon className="h-5 w-5" /></div>
        <div>
          <h3 className="font-bold">{title}</h3>
          <div className="mt-1 text-xs text-slate-500">{status}</div>
        </div>
      </div>
      <ArrowLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" />
    </Link>
  );
}

function FinancialMetrics({ company }: { company: CompanyReportData }) { const r = company.ratios; return <section className="bank-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">المؤشرات المالية الأساسية</h2></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3"><Metric label="نسبة السيولة" value={optionalNumber(r.currentRatio, "مرة")} note="الأصول المتداولة ÷ الالتزامات المتداولة" /><Metric label="نسبة المديونية" value={pct(r.debtRatio, true)} note="الالتزامات ÷ الأصول" /><Metric label="هامش صافي الربح" value={pct(r.netProfitMargin, true)} note="صافي الربح ÷ الإيرادات" /><Metric label="DSCR" value={r.dscr == null ? "غير متوفر" : `${r.dscr.toFixed(2)} مرة`} note={r.dscr == null ? "يلزم CFADS وخدمة دين تعاقدية كاملة" : "CFADS ÷ خدمة الدين التعاقدية"} /><Metric label="العائد على الأصول" value={pct(r.roa, true)} note="ROA" /><Metric label="التدفق النقدي الحر" value={money(r.freeCashFlow || 0)} note="التشغيلي بعد الاستثمار" /></div></section>; }
function HeroMetric({ label, value }: { label:string; value:string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>; }
function Kpi({ label, value, icon: Icon }: { label:string; value:string; icon:any }) { return <div className="bank-card flex items-center gap-3 p-4"><div className="bank-icon-box h-10 w-10"><Icon className="h-5 w-5" /></div><div><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div></div>; }
function Insight({ tone, title, text }: { tone:"good"|"warn"|"info"; title:string; text:string }) { const cls = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#D9E2EC] bg-[#F8FAFC] text-[#0B1F3A]"; return <div className={`rounded-xl border p-3 ${cls}`}><p className="text-[10px] font-bold">{title}</p><p className="mt-1 text-xs leading-5">{text}</p></div>; }
function CalcItem({ label, value }: { label:string; value:string }) { return <div className="bg-white p-4"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-2 text-sm font-bold">{value}</p></div>; }
function Metric({ label, value, note }: { label:string; value:string; note:string }) { return <div className="bg-white p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></div>; }
function DocumentStatus({ label, complete, detail }: { label: string; complete: boolean; detail: string }) { return <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${complete ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}><CheckCircle2 className="h-4 w-4" /></div><div><p className="text-xs font-bold">{label}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div></div>; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-xs font-bold tabular-nums">{value}</p></div>; }
function optionalMoney(value: number | null | undefined) { return value == null ? "غير متوفر" : money(value); }
function optionalNumber(value: number | null | undefined, unit="") { return value == null ? "غير متوفر" : `${value.toFixed(2)} ${unit}`.trim(); }
function strengthText(company: CompanyReportData | null) { if (!company) return "اكتمال مسار التقديم وتوفر بيانات قابلة للمراجعة."; if ((company.ratios.dscr || 0) >= 1.5) return `قدرة خدمة دين جيدة (DSCR ${company.ratios.dscr?.toFixed(2)}).`; if ((company.ratios.currentRatio || 0) >= 1.5) return `سيولة جارية جيدة (${company.ratios.currentRatio?.toFixed(2)} مرة).`; return "وجود قوائم مالية ومؤشرات قابلة للقياس والمقارنة."; }
