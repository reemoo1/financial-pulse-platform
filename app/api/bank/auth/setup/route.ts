import { NextRequest, NextResponse } from "next/server";
import {
  BANK_SESSION_COOKIE,
  BANK_SESSION_MAX_AGE,
  createSessionToken,
  hashPassword,
} from "@/lib/auth";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { createInitialBankUser } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return NextResponse.json(
      { error: "أدخلي الاسم والبريد الصحيح وكلمة مرور من 8 أحرف على الأقل." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const user = await createInitialBankUser({
    name,
    email,
    passwordHash: await hashPassword(password),
  });
  if (!user) {
    return NextResponse.json(
      { error: "تم إعداد حساب البنك مسبقًا. استخدمي تسجيل الدخول." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    BANK_SESSION_COOKIE,
    createSessionToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "admin",
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: BANK_SESSION_MAX_AGE,
    },
  );
  return response;
}
