import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "تم إلغاء إنشاء حسابات الشركات. يمكن تقديم الطلب ومتابعته برقم المعاملة ورمز OTP." }, { status: 410 });
}
