import { NextRequest, NextResponse } from "next/server";

// Vercel's infrastructure has first-party integration with Next.js that
// guarantees req.nextUrl always reflects the true public-facing host and
// protocol. Generic hosts behind a standard reverse proxy (Render, Railway,
// etc.) don't have that same guarantee — the app can see an internal
// http://+port origin even though the real request came in over https on
// the public domain. To handle both correctly, also compute an "expected"
// origin from the standard X-Forwarded-* headers those proxies set, and
// accept a match against either.
function forwardedOrigin(req: NextRequest): string | null {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  if (!host) return null;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function matchesKnownOrigin(req: NextRequest, candidate: string): boolean {
  if (candidate === req.nextUrl.origin) return true;
  const proxied = forwardedOrigin(req);
  return proxied !== null && candidate === proxied;
}

export function isSameOriginMutation(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) return matchesKnownOrigin(req, origin);
  const referer = req.headers.get("referer");
  if (!referer) return process.env.NODE_ENV !== "production";
  try {
    return matchesKnownOrigin(req, new URL(referer).origin);
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
