import { NextRequest, NextResponse } from "next/server";

export function isSameOriginMutation(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) return origin === req.nextUrl.origin;
  const referer = req.headers.get("referer");
  if (!referer) return process.env.NODE_ENV !== "production";
  try {
    return new URL(referer).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}

export function csrfErrorResponse() {
  return NextResponse.json(
    { error: "تم رفض الطلب لعدم اجتياز التحقق الأمني." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
