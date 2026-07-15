import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionTokenEdge,
  BANK_SESSION_COOKIE,
} from "@/lib/authEdge";

/**
 * Company accounts were removed from the public journey. Customers follow the
 * request, upload requested guarantees, and view post-approval updates through
 * the OTP-protected inquiry page instead of a separate company dashboard.
 *
 * /bank/* routes (other than /bank/login itself) require a valid bank staff
 * session — merged in from the standalone bank portal's own middleware.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/company/auth") ||
    pathname.startsWith("/company/dashboard") ||
    pathname.startsWith("/company/financing") ||
    pathname.startsWith("/company/guarantees")
  ) {
    return NextResponse.redirect(new URL("/inquiry", req.url));
  }

  if (pathname.startsWith("/bank") && pathname !== "/bank/login") {
    const token = req.cookies.get(BANK_SESSION_COOKIE)?.value;
    if (!(await verifySessionTokenEdge(token))) {
      return NextResponse.redirect(new URL("/bank/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/company/auth/:path*",
    "/company/dashboard/:path*",
    "/company/financing/:path*",
    "/company/guarantees/:path*",
    "/bank/:path*",
  ],
};
