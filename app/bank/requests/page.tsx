export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, FileText, ShieldCheck } from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deriveRequestProfile } from "@/lib/bankPortfolio";
import { getReport, listFinancingRequests } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import { money, RiskBadge, StatusBadge } from "@/components/bank/BankUI";

export default async function BankRequestsPage() {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const requests = (await listFinancingRequests()).sort((a, b) =>
    (b.data.metadata?.lastUpdate || b.createdAt).localeCompare(a.data.metadata?.lastUpdate || a.createdAt),
  );
  const rows = await Promise.all(requests.map(async (request) => ({
    request,
    profile: deriveRequestProfile(request, await getReport(request.data.input.reportId)),
  })));

  return (
    <BankShell user={session} title="طلبات التمويل" subtitle="الطلب والتحليل والقرار والضمانات في ملف واحد لكل شركة">
      <div className="bank-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">جميع الطلبات الواردة</h2>
        </div>
        {rows.length ? (
          <div className="divide-y divide-slate-100">
            {rows.map(({ request, profile }) => (
              <Link key={request.id} href={`/bank/requests/${request.id}`} className="group grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_.8fr_.8fr_.9fr_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="bank-icon-box h-11 w-11 shrink-0"><Building2 className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className="truncate font-bold">{request.data.applicantName}</p><p className="mt-1 text-[10px] text-slate-500">{request.data.sector} · رقم {request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()}</p></div>
                </div>
                <div><p className="text-[10px] text-slate-400">التمويل المطلوب</p><p className="mt-1 text-sm font-bold">{money(request.data.input.requestedAmount)}</p></div>
                <div><p className="text-[10px] text-slate-400">المخاطر</p><div className="mt-1"><RiskBadge risk={profile.risk} /></div><p className="mt-1 text-[9px] text-slate-400">PD {profile.pd.toFixed(1)}%</p></div>
                <div><p className="text-[10px] text-slate-400">الضمان داخل الطلب</p>{request.data.collateral ? <div className="mt-1 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#0B1F3A]" /><span className="text-xs font-bold">{money(request.data.collateral.currentEligibleValue)} / {money(request.data.collateral.requiredEligibleValue)}</span></div> : <p className="mt-1 text-xs text-slate-400">يظهر بعد الموافقة</p>}</div>
                <div className="flex items-center gap-2"><StatusBadge status={request.data.status} /><ArrowLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" /></div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">لا توجد طلبات واردة حتى الآن.</p></div>
        )}
      </div>
    </BankShell>
  );
}
