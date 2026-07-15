export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getFinancingRequest } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import PaymentTimeline from "@/components/bank/PaymentTimeline";

export default async function MonitoringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = verifySessionToken((await cookies()).get(BANK_SESSION_COOKIE)?.value);
  if (!session) redirect("/bank/login");
  const { id } = await params;
  const request = await getFinancingRequest(id);
  if (!request) notFound();

  const installments = request.data.operations?.installments || [];
  const disbursements = request.data.operations?.disbursements || [];
  const startDate = disbursements[0]?.disbursementDate || null;
  const endDate = installments.length ? installments[installments.length - 1].dueDate : null;
  const financingAmount = request.data.creditReview?.approvedAmount || request.data.input.requestedAmount;
  const termMonths = request.data.creditReview?.approvedTermMonths || request.data.input.termMonths;

  return (
    <BankShell
      user={session}
      title={`المتابعة الشهرية — ${request.data.applicantName}`}
      subtitle={`طلب ${request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()}`}
    >
      <div className="space-y-6">
        <Link href={`/bank/requests/${request.id}`} className="bank-link inline-flex items-center gap-2 text-xs text-slate-500">
          <ArrowRight className="h-4 w-4" />
          العودة إلى ملف الطلب
        </Link>

        <PaymentTimeline
          requestId={request.id}
          header={{
            referenceNumber: request.data.referenceNumber || request.id.slice(0, 8).toUpperCase(),
            applicantName: request.data.applicantName,
            financingAmount,
            termMonths,
            startDate,
            endDate,
            status: request.data.status,
          }}
          installments={installments}
        />
      </div>
    </BankShell>
  );
}
