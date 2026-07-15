export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  INQUIRY_COLLATERAL_COOKIE,
  verifyInquiryCollateralAccessToken,
} from "@/lib/auth";
import { getFinancingRequest } from "@/lib/store";
import CompanyCollateralSubmission from "@/components/CompanyCollateralSubmission";

export default async function InquiryGuaranteePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = verifyInquiryCollateralAccessToken(
    (await cookies()).get(INQUIRY_COLLATERAL_COOKIE)?.value,
    id,
  );
  if (!token) redirect("/inquiry");

  const request = await getFinancingRequest(id);
  if (!request || request.data.applicantName !== token.applicantName) notFound();
  if (!request.data.collateral) redirect("/inquiry");

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/inquiry"
            className="portal-link inline-flex items-center gap-2 text-xs"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى الاستعلام
          </Link>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#D9E2EC] bg-white px-4 py-2 text-xs text-[#475569] shadow-sm">
            <ShieldCheck className="h-4 w-4 text-[#0B1F3A]" />
            جلسة آمنة بعد التحقق برمز OTP — تنتهي خلال ساعة
          </div>
        </div>
        <CompanyCollateralSubmission
          requestId={id}
          initialCollateral={request.data.collateral}
        />
      </div>
    </main>
  );
}
