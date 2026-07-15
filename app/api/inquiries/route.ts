import { NextRequest, NextResponse } from "next/server";
import {
  verifyFinancingRequestOtpAttempt,
  getFinancingRequestByReferenceNumber,
} from "@/lib/store";
import { normalizeOtp } from "@/lib/otp";
import { publicFileSummary } from "@/lib/fileUpload";
import { FINANCING_STATUS_LABELS } from "@/lib/financingLifecycle";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import {
  createInquiryCollateralAccessToken,
  INQUIRY_COLLATERAL_COOKIE,
  INQUIRY_COLLATERAL_MAX_AGE,
} from "@/lib/auth";

const statusLabel: Record<string, string> = FINANCING_STATUS_LABELS;

export async function POST(req: NextRequest) {
  const ipLimit = checkRateLimit(req, {
    namespace: "inquiry-ip",
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if ("retryAfter" in ipLimit) return rateLimitResponse(ipLimit.retryAfter);

  try {
    const { inquiryNumber, otp } = await req.json();
    const cleanInquiryNumber = String(inquiryNumber || "").trim();
    const cleanOtp = normalizeOtp(String(otp || ""));

    if (!cleanInquiryNumber || cleanOtp.length !== 6) {
      return NextResponse.json(
        { error: "يرجى إدخال رقم الاستعلام ورمز OTP بشكل صحيح" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const ticketLimit = checkRateLimit(req, {
      namespace: "inquiry-ticket",
      identifier: cleanInquiryNumber,
      limit: 8,
      windowMs: 15 * 60_000,
    });
    if ("retryAfter" in ticketLimit) {
      return rateLimitResponse(ticketLimit.retryAfter);
    }

    const matchedRequest = await getFinancingRequestByReferenceNumber(
      cleanInquiryNumber,
    );
    console.log("[inquiry-verify-lookup]", {
      cleanInquiryNumber,
      cleanOtp,
      found: Boolean(matchedRequest),
    });
    if (!matchedRequest) return invalidCredentials();

    const verification = await verifyFinancingRequestOtpAttempt(
      matchedRequest.id,
      cleanOtp,
    );
    console.log("[inquiry-verify-result]", {
      status: verification.status,
    });
    if (verification.status === "locked") {
      return NextResponse.json(
        { error: "تم إيقاف رمز التحقق بعد تجاوز عدد المحاولات المسموح" },
        { status: 423, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (verification.status === "expired") {
      return NextResponse.json(
        { error: "انتهت صلاحية رمز التحقق. يرجى إنشاء طلب جديد." },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (verification.status !== "ok") return invalidCredentials();

    const request = verification.request;
    const metadata = request.data.metadata || {};
    const collateral = request.data.collateral;
    const lockedCollateralStatuses = new Set([
      "under_review",
      "approved",
      "perfection_pending",
      "active",
      "enforcement",
      "released",
    ]);
    const collateralAction = collateral
      ? {
          available: true,
          url: `/inquiry/guarantees/${request.id}`,
          status: collateral.status,
          requiredEligibleValue: collateral.requiredEligibleValue,
          requiredCoverageRatio: collateral.requiredCoverageRatio,
          currentEligibleValue: collateral.currentEligibleValue,
          coverageRatio: collateral.coverageRatio,
          shortfall: collateral.shortfall,
          canSubmit: !lockedCollateralStatuses.has(collateral.status),
        }
      : {
          available: false,
          url: null,
          status: null,
          requiredEligibleValue: 0,
          requiredCoverageRatio: 0,
          currentEligibleValue: 0,
          coverageRatio: 0,
          shortfall: 0,
          canSubmit: false,
        };

    const response = NextResponse.json(
      {
        requestId: request.id,
        ticketNumber: metadata.ticketNumber || request.id,
        inquiryNumber: metadata.inquiryNumber || request.id,
        requestStatus: statusLabel[request.data.status] || request.data.status,
        requestStatusCode: request.data.status,
        requestDetails: {
          applicantName: request.data.applicantName,
          applicantType: request.data.applicantType,
          sector: request.data.sector,
          contactName: request.data.input.contactName,
          phone: request.data.input.phone,
          email: request.data.input.email,
          requestedAmount: request.data.input.requestedAmount,
          purpose: request.data.input.purpose,
          termMonths: request.data.input.termMonths,
          financingProvider: request.data.bankQuote.bank.name,
          estimatedRate: request.data.bankQuote.estimatedRate,
        },
        submissionDate: metadata.submissionDate || request.createdAt,
        lastUpdate: metadata.lastUpdate || request.createdAt,
        notes: request.data.input.notes || "لا توجد ملاحظات",
        uploadedFiles: (request.data.uploadedFiles || []).map(publicFileSummary),
        submissionHistory: (request.data.history || []).map((item) => ({
          status: statusLabel[item.status] || item.status,
          statusCode: item.status,
          note: item.note,
          updatedAt: item.updatedAt,
          actor: item.actor,
        })),
        latestUpdates:
          request.data.history?.slice(-1)[0]?.note || "تم استلام الطلب",
        lifecycle: request.data.lifecycle,
        creditDecision: request.data.creditReview
          ? {
              decision: request.data.creditReview.finalDecision || null,
              approvedAmount: request.data.creditReview.approvedAmount || request.data.creditReview.recommendedAmount || 0,
              approvedRate: request.data.creditReview.approvedRate || request.data.creditReview.recommendedRate || 0,
              approvedTermMonths: request.data.creditReview.approvedTermMonths || request.data.creditReview.recommendedTermMonths || request.data.input.termMonths,
              conditions: (request.data.creditReview.conditionChecklist || []).map((condition) => ({
                id: condition.id,
                title: condition.title,
                required: condition.required,
                status: condition.status,
                note: condition.note || "",
              })),
            }
          : null,
        operations: request.data.operations
          ? {
              totalDisbursed: request.data.operations.totalDisbursed,
              remainingUndisbursed: request.data.operations.remainingUndisbursed,
              disbursements: request.data.operations.disbursements.map((item) => ({
                id: item.id,
                amount: item.amount,
                mode: item.mode,
                disbursementDate: item.disbursementDate,
                transferReference: item.transferReference,
              })),
              installments: request.data.operations.installments.map((item) => ({
                id: item.id,
                sequence: item.sequence,
                dueDate: item.dueDate,
                amountDue: item.amountDue,
                paidAmount: item.paidAmount,
                daysPastDue: item.daysPastDue,
                status: item.status,
              })),
            }
          : null,
        monitoring: request.data.monitoring
          ? {
              cadence: request.data.monitoring.cadence,
              nextSubmissionDate: request.data.monitoring.nextSubmissionDate || null,
              snapshots: request.data.monitoring.snapshots.slice(-6).map((snapshot) => ({
                id: snapshot.id,
                period: snapshot.period,
                dscr: snapshot.dscr,
                currentRatio: snapshot.currentRatio,
                debtRatio: snapshot.debtRatio,
                daysPastDue: snapshot.daysPastDue,
                healthScore: snapshot.healthScore,
                probabilityOfDefault: snapshot.probabilityOfDefault,
                status: snapshot.status,
                alerts: snapshot.alerts,
              })),
              actions: request.data.monitoring.actions.filter((action) => action.status !== "completed" && action.status !== "cancelled").map((action) => ({
                id: action.id,
                title: action.title,
                dueDate: action.dueDate || null,
                status: action.status,
                note: action.note || "",
              })),
            }
          : null,
        collateralAction,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );

    response.cookies.set(
      INQUIRY_COLLATERAL_COOKIE,
      createInquiryCollateralAccessToken(
        request.id,
        request.data.applicantName,
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: INQUIRY_COLLATERAL_MAX_AGE,
      },
    );
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "تعذر تنفيذ الاستعلام. يرجى المحاولة مرة أخرى." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function invalidCredentials() {
  return NextResponse.json(
    { error: "رقم الاستعلام أو رمز OTP غير صحيح" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
