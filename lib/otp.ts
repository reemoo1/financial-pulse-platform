import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

const OTP_LENGTH = 6;

export function generateOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export function hashOtp(
  otp: string,
  salt = randomBytes(16).toString("hex"),
): { salt: string; hash: string } {
  const normalized = normalizeOtp(otp);
  const hash = createHash("sha256")
    .update(`${salt}:${normalized}`)
    .digest("hex");
  return { salt, hash };
}

export function verifyOtp(
  otp: string,
  salt?: string,
  expectedHash?: string,
): boolean {
  if (!salt || !expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }
  const { hash } = hashOtp(otp, salt);
  try {
    return timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(expectedHash, "hex"),
    );
  } catch {
    return false;
  }
}

export function normalizeOtp(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/**
 * Short, human-friendly reference number (5 digits) shown to users on
 * reports and confirmations. Not used for security — just a display label.
 */
export function generateReferenceNumber(): string {
  return randomInt(10000, 100000).toString();
}
