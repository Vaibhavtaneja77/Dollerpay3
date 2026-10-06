import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { rateLimitResponse } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { authEmailSchema } from "@/lib/validation";

function getClientKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = authEmailSchema.parse(await request.json());
    const emailKey = body.email.toLowerCase();
    const ipKey = getClientKey(request);

    const limitedByIp = await rateLimitResponse(`auth-reset-ip:${ipKey}`, 5, 10 * 60_000);
    if (limitedByIp) return limitedByIp;

    const limitedByEmail = await rateLimitResponse(`auth-reset-email:${emailKey}`, 1, 10 * 60_000);
    if (limitedByEmail) {
      return ok(
        { error: "Password reset email already requested. Please wait a few minutes before trying again." },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${request.nextUrl.origin}/settings`
    });

    if (error?.message.toLowerCase().includes("rate limit")) {
      return ok(
        { error: "Too many email attempts right now. Please wait a few minutes before requesting another reset email." },
        { status: 429, headers: { "Retry-After": "300" } }
      );
    }

    if (error) return ok({ error: error.message }, { status: 400 });

    return ok({ message: "Password reset email sent." });
  } catch (error) {
    return fail(error);
  }
}
