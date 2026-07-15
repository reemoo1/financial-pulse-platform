export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BANK_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deriveRequestProfile } from "@/lib/bankPortfolio";
import { buildAiCreditRecommendation } from "@/lib/creditAi";
import {
  collateralContextFromRequest,
  isCollateralReadyForDisbursement,
  requiredCollateralCoverageRatio,
} from "@/lib/collateral";
import { getFinancingRequest, getReport } from "@/lib/store";
import BankShell from "@/components/bank/BankShell";
import CreditDecisionPanel from "@/components/bank/CreditDecisionPanel";

export default async function CreditDecisionPage({ params }: { params: Promise<{ id: string }> }) {
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
  const collateralRequired = policyCoverageRatio > 0;
  const collateralApproved = Boolean(request.data.collateral?.allMandatoryApproved);
  const collateralShortfall = Number(request.data.collateral?.shortfall || 0);

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
      title={`قرار الائتمان — ${request.data.applicantName}`}
      subtitle={`طلب ${request.data.referenceNumber || request.id.slice(0, 8).toUpperCase()}`}
    >
      <div className="space-y-6">
        <Link href={`/bank/requests/${request.id}`} className="bank-link inline-flex items-center gap-2 text-xs text-slate-500">
          <ArrowRight className="h-4 w-4" />
          العودة إلى ملف الطلب
        </Link>

        <div className="mx-auto max-w-2xl">
          <CreditDecisionPanel
            requestId={request.id}
            status={request.data.status}
            review={request.data.creditReview}
            suggestedAmount={suggestedAmount}
            suggestedRate={suggestedRate}
            requestedTerm={request.data.creditReview?.calculationOverrides?.termMonthsOverride || request.data.input.termMonths}
            aiSuggestion={aiRecommendation}
            userRole={session.role || "admin"}
            collateralRequired={collateralRequired}
            collateralApproved={collateralApproved}
            collateralShortfall={collateralShortfall}
          />
        </div>
      </div>
    </BankShell>
  );
}
