// Authentication primitives shared by the bank, company, and scoped report
// access flows. Password derivation uses asynchronous scrypt so authentication
// does not block the Node.js event loop.

import crypto from "crypto";
import { promisify } from "util";
import { BankRole } from "./types";

const scryptAsync = promisify(crypto.scrypt);
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
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // company session
const BANK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // bank staff: 8 hours
const REPORT_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours
const INQUIRY_COLLATERAL_MAX_AGE_SECONDS = 60 * 60; // 1 hour after OTP verification

let warnedAboutDevSecret = false;

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.BANK_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters.",
    );
  }

  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn(
      "[auth] Using the development-only session secret. Set SESSION_SECRET before deployment.",
    );
  }
  return DEV_SESSION_SECRET;
}

/* ------------------------------------------------------------------ *
 * Password hashing
 * ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, derivedHex] = stored.split(":");
  if (!salt || !derivedHex || !/^[a-f0-9]+$/i.test(derivedHex)) return false;

  try {
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuffer = Buffer.from(derivedHex, "hex");
    return (
      derived.length === storedBuffer.length &&
      crypto.timingSafeEqual(derived, storedBuffer)
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Signed sessions
 * ------------------------------------------------------------------ */

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role?: BankRole;
  iat?: number;
  sessionId?: string;
  exp: number;
}

export interface CompanySessionPayload {
  companyId: string;
  crNumber: string;
  companyName: string;
  exp: number;
}

export interface ReportAccessPayload {
  reportId: string;
  exp: number;
}

export interface InquiryCollateralAccessPayload {
  requestId: string;
  applicantName: string;
  exp: number;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

function encodeToken<T extends { exp: number }>(payload: T): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeToken<T extends { exp: number }>(
  token: string | undefined | null,
): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return null;
  }
  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as T;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp" | "iat" | "sessionId">,
): string {
  const now = Math.floor(Date.now() / 1000);
  return encodeToken({
    ...payload,
    iat: now,
    sessionId: crypto.randomUUID(),
    exp: now + BANK_SESSION_MAX_AGE_SECONDS,
  });
}

export function verifySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  return decodeToken<SessionPayload>(token);
}

export function createCompanySessionToken(
  payload: Omit<CompanySessionPayload, "exp">,
): string {
  return encodeToken({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyCompanySessionToken(
  token: string | undefined | null,
): CompanySessionPayload | null {
  return decodeToken<CompanySessionPayload>(token);
}

export function createReportAccessToken(reportId: string): string {
  return encodeToken({
    reportId,
    exp: Math.floor(Date.now() / 1000) + REPORT_ACCESS_MAX_AGE_SECONDS,
  });
}

export function verifyReportAccessToken(
  token: string | undefined | null,
  reportId: string,
): ReportAccessPayload | null {
  const payload = decodeToken<ReportAccessPayload>(token);
  return payload?.reportId === reportId ? payload : null;
}

export function createInquiryCollateralAccessToken(
  requestId: string,
  applicantName: string,
): string {
  return encodeToken({
    requestId,
    applicantName,
    exp: Math.floor(Date.now() / 1000) + INQUIRY_COLLATERAL_MAX_AGE_SECONDS,
  });
}

export function verifyInquiryCollateralAccessToken(
  token: string | undefined | null,
  requestId: string,
): InquiryCollateralAccessPayload | null {
  const payload = decodeToken<InquiryCollateralAccessPayload>(token);
  return payload?.requestId === requestId ? payload : null;
}

export const BANK_SESSION_COOKIE = "fp_bank_session";
export const COMPANY_SESSION_COOKIE = "fp_company_session";
export const REPORT_ACCESS_COOKIE = "fp_report_access";
export const INQUIRY_COLLATERAL_COOKIE = "fp_inquiry_collateral";
export const BANK_SESSION_MAX_AGE = BANK_SESSION_MAX_AGE_SECONDS;
export const COMPANY_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;
export const REPORT_ACCESS_MAX_AGE = REPORT_ACCESS_MAX_AGE_SECONDS;
export const INQUIRY_COLLATERAL_MAX_AGE = INQUIRY_COLLATERAL_MAX_AGE_SECONDS;
