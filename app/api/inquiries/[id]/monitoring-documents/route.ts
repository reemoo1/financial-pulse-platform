import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  INQUIRY_COLLATERAL_COOKIE,
  verifyInquiryCollateralAccessToken,
} from "@/lib/auth";
import { saveUploadedFile } from "@/lib/fileUpload";
import { isSameOriginMutation, csrfErrorResponse } from "@/lib/requestSecurity";
import { appendMonitoringDocumentByCompany, getFinancingRequest } from "@/lib/store";
import { withoutTicketSecurity } from "@/lib/sanitize";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const { id } = await params;
  const token = verifyInquiryCollateralAccessToken(
    (await cookies()).get(INQUIRY_COLLATERAL_COOKIE)?.value,
    id,
  );
  if (!token) return NextResponse.json({ error: "انتهت جلسة الاستعلام. أعد التحقق برمز OTP." }, { status: 401 });

  const request = await getFinancingRequest(id);
  if (!request || request.data.applicantName !== token.applicantName) {
    return NextResponse.json({ error: "الطلب غير موجود أو لا تملكين صلاحية الوصول إليه." }, { status: 404 });
  }

  const form = await req.formData();
  const period = String(form.get("period") || "").trim().slice(0, 7);
  const note = String(form.get("note") || "").trim().slice(0, 1000);
  const file = form.get("file");
  if (!/^\d{4}-\d{2}$/.test(period) || !(file instanceof File) || !file.name) {
    return NextResponse.json({ error: "يرجى اختيار الفترة ورفع ملف صحيح." }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(id, file, "monitoring_statement");
    const updated = await appendMonitoringDocumentByCompany(
      id,
      saved.metadata,
      { name: token.applicantName, accessMethod: "otp_inquiry" },
      period,
      note,
    );
    if (!updated) return NextResponse.json({ error: "تعذر تحديث الطلب." }, { status: 404 });
    return NextResponse.json(withoutTicketSecurity(updated), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر رفع المستند." }, { status: 400 });
  }
}
