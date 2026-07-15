/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";
const scriptPolicy = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      scriptPolicy,
      "connect-src 'self'",
      ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Hide the black Next.js development indicator (the floating N button).
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  // TypeScript is enforced by the build script before Next.js compilation.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  serverExternalPackages: ["pdfjs-dist"],
};

module.exports = nextConfig;
