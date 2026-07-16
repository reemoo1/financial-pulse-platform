export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deriveRequestProfile } from "@/lib/bankPortfolio";
import { buildBankPortfolioAlerts } from "@/lib/companyInsights";
import { listFinancingRequests, getReport } from "@/lib/store";
import { StoredFinancingRequest } from "@/lib/types";
import BankShell from "@/components/bank/BankShell";
import SmartAlertsPanel from "@/components/SmartAlertsPanel";
import { money, RiskBadge, StatusBadge } from "@/components/bank/BankUI";

export default async function BankDashboardPage() {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const requests = await listFinancingRequests();
  const rows = await Promise.all(
    requests.map(async (request) => ({
      request,
      profile: deriveRequestProfile(request, await getReport(request.data.input.reportId)),
    })),
  );

  const pending = rows.filter(({ request }) => ["submitted", "pending", "under_review", "bank_review", "conditional_approval"].includes(request.data.status)).length;
  const approved = rows.filter(({ request }) => ["approved", "disbursed", "monitoring", "warning", "restructured", "closed", "defaulted"].includes(request.data.status)).length;
  const approvalRate = rows.length ? (approved / rows.length) * 100 : 0;
  const newRequests = rows.filter(({ request }) =>
    ["submitted", "pending", "under_review", "bank_review"].includes(request.data.status),
  ).length;
  const highRiskRequests = rows.filter(({ profile }) => profile.risk === "high").length;
  const activeFinancings = rows.filter(({ request }) =>
    ["disbursed", "monitoring", "warning", "restructured"].includes(request.data.status),
  ).length;
  const averagePd = rows.length
    ? rows.reduce((sum, row) => sum + row.profile.pd, 0) / rows.length
    : 0;
  const portfolioAlerts = buildBankPortfolioAlerts({
    newRequests,
    highRiskRequests,
    activeFinancings,
    averagePd,
  });
  const priority = [...rows]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 7);
  const riskCounts = {
    low: rows.filter((row) => row.profile.risk === "low").length,
    medium: rows.filter((row) => row.profile.risk === "medium").length,
    high: rows.filter((row) => row.profile.risk === "high").length,
  };

  return (
    <BankShell user={session} title="مركز قيادة الائتمان">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={FileText} label="الطلبات الجديدة" value={String(newRequests)} note="بانتظار المراجعة الائتمانية" />
          <Stat icon={ShieldAlert} label="طلبات عالية المخاطر" value={String(highRiskRequests)} note="تحتاج تصعيدًا أو مراجعة إضافية" />
          <Stat icon={WalletCards} label="التمويلات النشطة" value={String(activeFinancings)} note="قيد الصرف أو المتابعة" />
          <Stat icon={TrendingUp} label="نسبة التعثر المتوقعة" value={`${averagePd.toFixed(1)}%`} note="متوسط PD للمحفظة" />
        </section>

        <SmartAlertsPanel alerts={portfolioAlerts} title="تنبيهات المحفظة" className="bank-card p-5" />

        <section className="grid gap-4 sm:grid-cols-2">
          <Stat icon={FileText} label="إجمالي الطلبات" value={String(rows.length)} note={`${pending} طلبات تحتاج مراجعة`} />
          <Stat icon={CheckCircle2} label="الطلبات المعتمدة" value={String(approved)} note={`نسبة الموافقة ${approvalRate.toFixed(1)}%`} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="bank-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div><h2 className="font-bold">قائمة الأولوية</h2><p className="mt-1 text-xs text-slate-500">مرتبة حسب التعثر والإنذار واحتمال التعثر وحالة المراجعة</p></div>
              <Link href="/bank/requests" className="bank-link flex items-center gap-2 text-xs">كل الطلبات <ArrowLeft className="h-4 w-4" /></Link>
            </div>
            {priority.length ? (
              <div className="divide-y divide-slate-100">
                {priority.map(({ request, profile }) => (
                  <Link key={request.id} href={`/bank/requests/${request.id}`} className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center">
                    <div className="bank-icon-box h-10 w-10"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{request.data.applicantName}</p><p className="mt-1 text-[10px] text-slate-500">PD {profile.pd.toFixed(1)}% · صحة {profile.health.toFixed(0)}% · إنذار {profile.warning.toFixed(0)}%</p></div>
                    <div className="flex flex-wrap items-center gap-2"><RiskBadge risk={profile.risk} /><StatusBadge status={request.data.status} /><span className="text-xs font-bold">{money(request.data.input.requestedAmount)}</span></div>
                  </Link>
                ))}
              </div>
            ) : <Empty />}
          </div>

          <div>
            <div className="bank-card p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#0B1F3A]" /><h2 className="font-bold">توزيع المخاطر</h2></div>
              <div className="mt-5 space-y-4">
                <RiskLine label="منخفض" value={riskCounts.low} total={rows.length} tone="low" />
                <RiskLine label="متوسط" value={riskCounts.medium} total={rows.length} tone="medium" />
                <RiskLine label="مرتفع" value={riskCounts.high} total={rows.length} tone="high" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </BankShell>
  );
}

function priorityScore(row: { request: StoredFinancingRequest; profile: ReturnType<typeof deriveRequestProfile> }) { const { request, profile } = row; return (request.data.status === "defaulted" ? 120 : request.data.status === "warning" ? 90 : 0) + profile.pd + profile.warning + (["bank_review", "submitted", "under_review"].includes(request.data.status) ? 20 : 0); }
function Stat({ icon: Icon, label, value, note }: { icon:any; label:string; value:string; note:string }) { return <div className="bank-card fp-card p-5"><div className="fp-icon-box h-11 w-11"><Icon className="h-5 w-5" /></div><p className="mt-4 text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-2 text-[10px] text-slate-400">{note}</p></div>; }
function RiskLine({ label, value, total, tone }: { label:string; value:number; total:number; tone:"low"|"medium"|"high" }) { const width = total ? Math.max(4, value / total * 100) : 0; const cls = tone === "low" ? "bg-emerald-500" : tone === "high" ? "bg-rose-500" : "bg-amber-500"; return <div><div className="flex items-center justify-between text-xs"><span>{label}</span><strong>{value}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${cls}`} style={{ width: `${width}%` }} /></div></div>; }
function Empty() { return <div className="p-12 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">لا توجد طلبات تمويل بعد.</p></div>; }
