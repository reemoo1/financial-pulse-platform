export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, ReceiptText } from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { listFinancingRequests } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import { money } from "@/components/bank/BankUI";

export default async function MonitoringListPage() {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const requests = (await listFinancingRequests())
    .filter((request) => (request.data.operations?.installments || []).length > 0)
    .sort((a, b) => (b.data.metadata?.lastUpdate || b.createdAt).localeCompare(a.data.metadata?.lastUpdate || a.createdAt));

  return (
    <BankShell user={session} title="المتابعة الشهرية" subtitle="متابعة خطط السداد وحالة الدفعات لكل طلب">
      <div className="bank-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">الطلبات التي لديها جدول سداد نشط</h2>
        </div>
        {requests.length ? (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const installments = request.data.operations?.installments || [];
              const overdue = installments.filter((item) => item.status === "late" || item.daysPastDue > 0).length;
              const paid = installments.filter((item) => item.status === "paid" || item.status === "waived").length;
              return (
                <Link
                  key={request.id}
                  href={`/bank/requests/${request.id}/monitoring`}
                  className="group grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="bank-icon-box h-11 w-11 shrink-0"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="truncate font-bold">{request.data.applicantName}</p><p className="mt-1 text-[10px] text-slate-500">رقم {request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()}</p></div>
                  </div>
                  <div><p className="text-[10px] text-slate-400">إجمالي الدفعات</p><p className="mt-1 text-sm font-bold">{installments.length}</p></div>
                  <div><p className="text-[10px] text-slate-400">مسدد</p><p className="mt-1 text-sm font-bold text-emerald-700">{paid}</p></div>
                  <div><p className="text-[10px] text-slate-400">متأخر</p><p className={`mt-1 text-sm font-bold ${overdue > 0 ? "text-rose-700" : "text-slate-700"}`}>{overdue}</p></div>
                  <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-400" /><ArrowLeft className="h-4 w-4 text-slate-400 transition group-hover:-translate-x-1" /></div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center"><ReceiptText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">لا توجد خطط سداد نشطة حتى الآن.</p></div>
        )}
      </div>
    </BankShell>
  );
}
