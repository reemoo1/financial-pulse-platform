import { NextRequest, NextResponse } from "next/server";

interface RateLimitOptions {
  namespace: string;
  limit: number;
  windowMs: number;
  identifier?: string;
}

interface Bucket {
  timestamps: number[];
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __financialPulseRateLimit?: Map<string, Bucket>;
};

const buckets =
  globalForRateLimit.__financialPulseRateLimit || new Map<string, Bucket>();
globalForRateLimit.__financialPulseRateLimit = buckets;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions,
): { allowed: true; remaining: number } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const key = `${options.namespace}:${options.identifier || clientIp(req)}`;
  const cutoff = now - options.windowMs;
  const bucket = buckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > cutoff);

  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfter = Math.max(
      1,
      Math.ceil((oldest + options.windowMs - now) / 1000),
    );
    buckets.set(key, bucket);
    return { allowed: false, retryAfter };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: options.limit - bucket.timestamps.length };
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "محاولات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
