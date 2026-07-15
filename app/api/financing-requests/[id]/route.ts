import { NextRequest, NextResponse } from "next/server";
import { getFinancingRequest } from "@/lib/store";
import { getBankSession, getCompanySession } from "@/lib/apiAuth";
import { financingRequestPortalView } from "@/lib/sanitize";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bankSession = getBankSession(req);
  const companySession = getCompanySession(req);
  if (!bankSession && !companySession) {
    return NextResponse.json(
      { error: "يجب تسجيل الدخول للوصول إلى الطلب" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const request = await getFinancingRequest(id);
  if (!request) {
    return NextResponse.json(
      { error: "الطلب غير موجود" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    !bankSession &&
    (!request.data.ownerCompanyId ||
      request.data.ownerCompanyId !== companySession?.companyId)
  ) {
    return NextResponse.json(
      { error: "لا توجد صلاحية للوصول إلى هذا الطلب" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(financingRequestPortalView(request), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
