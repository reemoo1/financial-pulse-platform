import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "تم إلغاء تسجيل دخول الشركات. استخدم الاستعلام برقم المعاملة ورمز OTP." }, { status: 410 });
}
