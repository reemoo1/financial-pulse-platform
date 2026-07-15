import { NextRequest, NextResponse } from "next/server";
import {
  BANK_SESSION_COOKIE,
  BANK_SESSION_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";
import { getBankUserByEmail } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await getBankUserByEmail(email);

  if (!user || user.isActive === false || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

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
}
