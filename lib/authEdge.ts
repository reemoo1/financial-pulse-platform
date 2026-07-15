// Edge-runtime-compatible verification for middleware.ts.

const DEV_SESSION_SECRET = "dev-only-secret-change-in-production";

const configuredStartupSecret =
  process.env.SESSION_SECRET || process.env.BANK_SESSION_SECRET;
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (!configuredStartupSecret || configuredStartupSecret.length < 32)
) {
  throw new Error(
    "SESSION_SECRET is required in production and must be at least 32 characters.",
  );
}

export const BANK_SESSION_COOKIE = "fp_bank_session";
export const COMPANY_SESSION_COOKIE = "fp_company_session";

interface BasePayload {
  exp: number;
}

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.BANK_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters.",
    );
  }
  return DEV_SESSION_SECRET;
}

async function hmacHex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyToken<T extends BasePayload>(
  token: string | undefined | null,
): Promise<T | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacHex(body);
  if (!safeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as T;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifySessionTokenEdge(
  token: string | undefined | null,
): Promise<{ userId: string; email: string; name: string; role?: "admin" | "credit_analyst" | "risk_manager" | "operations" | "auditor"; exp: number } | null> {
  return verifyToken(token);
}

export function verifyCompanySessionTokenEdge(
  token: string | undefined | null,
): Promise<{
  companyId: string;
  crNumber: string;
  companyName: string;
  exp: number;
} | null> {
  return verifyToken(token);
}
