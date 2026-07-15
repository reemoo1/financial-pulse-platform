import { NextRequest, NextResponse } from "next/server";
import { BANK_SESSION_COOKIE } from "@/lib/auth";
import { csrfErrorResponse, isSameOriginMutation } from "@/lib/requestSecurity";

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return csrfErrorResponse();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(BANK_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
