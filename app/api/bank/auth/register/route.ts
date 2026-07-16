import { NextRequest, NextResponse } from "next/server";
import {
  BANK_SESSION_COOKIE,
  BANK_SESSION_MAX_AGE,
  createSessionToken,
  hashPassword,
} from "@/lib/auth";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { createBankUser } from "@/lib/store";

// Self-service sign-up for a bank account. Unlike /api/bank/auth/setup
// (which only ever creates the single very-first admin account), this
// endpoint can be called any number of times to create additional bank
// accounts — no existing admin session or invitation required. Intentionally
// not linked from the visible UI; reachable only via the hidden toggle on
// the login page.
export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();

  try {
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

    const user = await createBankUser({
      name,
      email,
      passwordHash: await hashPassword(password),
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      BANK_SESSION_COOKIE,
      createSessionToken({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "credit_analyst",
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
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
