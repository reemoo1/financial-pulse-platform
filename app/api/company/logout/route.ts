import { NextResponse } from "next/server";
import { COMPANY_SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COMPANY_SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
