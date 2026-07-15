import { NextResponse } from "next/server";
import {
  getFinancingRequestByReferenceNumber,
  updateFinancingRequestSecurity,
} from "@/lib/store";
import { hashOtp } from "@/lib/otp";
import { DEMO_SCENARIOS } from "@/lib/demoScenarios";

// مسار تطوير لمرة واحدة: يعيد رمز الـOTP الثابت لكل حالة من حالات المحاكاة
// الثلاث كما هو، حتى لو صفحة /inquiry الحقيقية كانت قد استبدلته برمز عشوائي
// أثناء التجربة قبل إصلاح app/api/inquiries/request-otp/route.ts.
// احذفي هذا الملف بعد الهاكاثون مع باقي ملفات /api/dev.

export async function GET() {
  const results: { referenceNumber: string; found: boolean; reset: boolean }[] = [];

  for (const scenario of DEMO_SCENARIOS) {
    const request = await getFinancingRequestByReferenceNumber(scenario.referenceNumber);
    if (!request) {
      results.push({ referenceNumber: scenario.referenceNumber, found: false, reset: false });
      continue;
    }

    const { salt, hash } = hashOtp(scenario.otp);
    await updateFinancingRequestSecurity(request.id, {
      otpSalt: salt,
      otpHash: hash,
      otpCreatedAt: new Date().toISOString(),
      otpExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      otpAttemptCount: 0,
      otpMaxAttempts: 1000,
    });
    results.push({ referenceNumber: scenario.referenceNumber, found: true, reset: true });
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
