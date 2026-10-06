import { ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"]
};

async function durableRateLimit(key: string, limit: number, windowMs: number) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs
    });
    if (error) return null;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      limited: Boolean(row.limited),
      remaining: Number(row.remaining ?? 0),
      resetAt: new Date(row.reset_at).getTime()
    };
  } catch {
    return null;
  }
}

export async function rateLimitResponse(key: string, limit = 20, windowMs = 60_000) {
  const durable = await durableRateLimit(key, limit, windowMs);
  const result = durable ?? rateLimit(key, limit, windowMs);
  if (!result.limited) return null;

  return ok(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
      }
    }
  );
}

export function getSafeUploadExtension(file: File, allowedTypes: Set<string>) {
  if (!allowedTypes.has(file.type)) return null;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = EXTENSIONS_BY_TYPE[file.type] ?? [];
  if (!allowedExtensions.includes(extension)) return null;

  return extension;
}

export function isSafeStoredPaymentAssetPath(path: string) {
  return /^(payouts|deposits|payment-methods)\/[A-Za-z0-9_-]+\/[0-9a-fA-F-]+\.(png|jpg|jpeg|webp|pdf)$/.test(path);
}
