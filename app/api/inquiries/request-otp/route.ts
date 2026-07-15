import { NextRequest, NextResponse } from "next/server";
import {
  getFinancingRequestByReferenceNumber,
  updateFinancingRequestSecurity,
} from "@/lib/store";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendTicketEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

// Generic response used in both the found and not-found cases so this
// endpoint can't be used to enumerate valid ticket/inquiry numbers.
const GENERIC_SUCCESS = {
  message:
    "إذا كان رقم الاستعلام صحيحًا، فقد تم إرسال رمز التحقق إلى البريد الإلكتروني المسجل على الطلب.",
};

export async function POST(req: NextRequest) {
  const ipLimit = checkRateLimit(req, {
    namespace: "inquiry-otp-request-ip",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if ("retryAfter" in ipLimit) return rateLimitResponse(ipLimit.retryAfter);

  try {
    const { inquiryNumber } = await req.json();
    const cleanInquiryNumber = String(inquiryNumber || "").trim();

    if (!cleanInquiryNumber) {
      return NextResponse.json(
        { error: "يرجى إدخال رقم الاستعلام" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const ticketLimit = checkRateLimit(req, {
      namespace: "inquiry-otp-request-ticket",
      identifier: cleanInquiryNumber,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if ("retryAfter" in ticketLimit) {
      return rateLimitResponse(ticketLimit.retryAfter);
    }

    const request = await getFinancingRequestByReferenceNumber(
      cleanInquiryNumber,
    );
    const email = request?.data.input.email?.trim();
    console.log("[inquiry-otp-lookup]", {
      cleanInquiryNumber,
      found: Boolean(request),
      email: email || null,
    });

    if (request && email) {
      const otp = generateOtp();
      const { salt, hash } = hashOtp(otp);
      const otpExpiresAt = new Date(
        Date.now() + Number(process.env.OTP_TTL_MINUTES || 30) * 60_000,
      ).toISOString();

      await updateFinancingRequestSecurity(request.id, {
        otpSalt: salt,
        otpHash: hash,
        otpCreatedAt: new Date().toISOString(),
        otpExpiresAt,
        otpAttemptCount: 0,
        otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
      });

      const delivery = await sendTicketEmail({
        to: email,
        subject: `رمز التحقق للاستعلام عن طلب التمويل — ${cleanInquiryNumber}`,
        text: [
          `رمز التحقق الخاص بك هو: ${otp}`,
          "",
          `صالح لمدة ${Number(process.env.OTP_TTL_MINUTES || 30)} دقيقة.`,
          "لا تشارك هذا الرمز مع أي شخص.",
          "",
          `رقم الاستعلام: ${cleanInquiryNumber}`,
        ].join("\n"),
      });
      console.log("[inquiry-otp-email-delivery]", delivery);
    }

    return NextResponse.json(GENERIC_SUCCESS, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "تعذر إرسال رمز التحقق. يرجى المحاولة مرة أخرى." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
