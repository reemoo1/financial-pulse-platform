import { NextRequest, NextResponse } from "next/server";
import { getCompanySession } from "@/lib/apiAuth";
import { saveUploadedFile } from "@/lib/fileUpload";
import { isSameOriginMutation, csrfErrorResponse } from "@/lib/requestSecurity";
import { appendMonitoringDocumentByCompany } from "@/lib/store";
import { withoutTicketSecurity } from "@/lib/sanitize";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const session = getCompanySession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const { id } = await params;
  const form = await req.formData();
  const period = String(form.get("period") || "").trim().slice(0, 7);
  const note = String(form.get("note") || "").trim().slice(0, 1000);
  const file = form.get("file");
  if (!/^\d{4}-\d{2}$/.test(period) || !(file instanceof File) || !file.name) {
    return NextResponse.json({ error: "يرجى اختيار الفترة ورفع ملف صحيح." }, { status: 400 });
  }
  try {
    const saved = await saveUploadedFile(id, file, "monitoring_statement");
    const updated = await appendMonitoringDocumentByCompany(id, saved.metadata, { companyId: session.companyId, name: session.companyName }, period, note);
    if (!updated) return NextResponse.json({ error: "الطلب غير موجود أو لا تملكين صلاحية الوصول إليه." }, { status: 404 });
    return NextResponse.json(withoutTicketSecurity(updated), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر رفع المستند." }, { status: 400 });
  }
}
