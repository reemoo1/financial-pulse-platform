import { NextRequest, NextResponse } from "next/server";
import { getCompanySession } from "@/lib/apiAuth";
import { getCompanyUserByCR } from "@/lib/store";

export async function GET(req: NextRequest) {
  const session = getCompanySession(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  const user = await getCompanyUserByCR(session.crNumber);
  if (!user) return NextResponse.json({ error: "ملف الشركة غير موجود." }, { status: 404 });
  return NextResponse.json({
    crNumber: user.crNumber,
    companyName: user.companyName,
    sector: user.sector,
    city: user.city,
    detailedActivity: user.detailedActivity || "",
    establishmentDate: user.establishmentDate || "",
    companyAgeYears: user.companyAgeYears || 0,
    phone: user.phone,
    email: user.email,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
