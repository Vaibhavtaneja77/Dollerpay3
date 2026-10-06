/** @type {import('next').NextConfig} */
const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedDevOrigins = Array.from(new Set(allowedOrigins.flatMap((origin) => {
    try {
      const url = new URL(origin);
      return [url.host, url.hostname];
    } catch {
      const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return [host, host.split(":")[0]].filter(Boolean);
    }
  }).filter(Boolean)));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = (() => {
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
})();
const connectSources = ["'self'", supabaseOrigin, "https://*.supabase.co", "wss://*.supabase.co"].filter(Boolean).join(" ");
const mediaSources = ["'self'", "data:", "blob:", supabaseOrigin, "https://*.supabase.co"].filter(Boolean).join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src ${mediaSources}`,
  `font-src 'self' data:`,
  `connect-src ${connectSources}`,
  `frame-src 'self' ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : ""
].filter(Boolean).join("; ");

const nextConfig = {
  turbopack: {
    root: import.meta.dirname
  },
  allowedDevOrigins,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy }
        ]
      }
    ];
  }
};

export default nextConfig;
