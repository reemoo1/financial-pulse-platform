export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { listFinancingRequests } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import { money, pct } from "@/components/bank/BankUI";

export default async function CollateralListPage() {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const requests = (await listFinancingRequests())
    .filter((request) => Boolean(request.data.collateral))
    .sort((a, b) => (b.data.metadata?.lastUpdate || b.createdAt).localeCompare(a.data.metadata?.lastUpdate || a.createdAt));

  return (
    <BankShell user={session} title="الضمانات" subtitle="عرض ومتابعة الضمانات المرتبطة بطلبات التمويل">
      <div className="bank-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">الطلبات التي لديها ضمانات</h2>
        </div>
        {requests.length ? (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const collateral = request.data.collateral!;
              return (
                <Link
                  key={request.id}
                  href={`/bank/requests/${request.id}/collateral`}
                  className="group grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_.9fr_.9fr_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="bank-icon-box h-11 w-11 shrink-0"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="truncate font-bold">{request.data.applicantName}</p><p className="mt-1 text-[10px] text-slate-500">رقم {request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()}</p></div>
                  </div>
                  <div><p className="text-[10px] text-slate-400">القيمة المؤهلة</p><p className="mt-1 text-sm font-bold">{money(collateral.currentEligibleValue)}</p></div>
                  <div><p className="text-[10px] text-slate-400">نسبة التغطية</p><p className="mt-1 text-sm font-bold">{pct(collateral.coverageRatio)}</p></div>
                  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" /><ArrowLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" /></div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">لا توجد طلبات بضمانات حتى الآن.</p></div>
        )}
      </div>
    </BankShell>
  );
}
