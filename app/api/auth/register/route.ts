import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/security";
import { registerSchema } from "@/lib/validation";

function getClientKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

function authEmailError(message?: string) {
  if (message?.toLowerCase().includes("rate limit")) {
    return ok(
      { error: "Too many email attempts right now. Please wait a few minutes before requesting another signup email." },
      { status: 429, headers: { "Retry-After": "300" } }
    );
  }

  return ok({ error: message ?? "Account could not be created. Please try again." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const emailKey = body.email.toLowerCase();
    const ipKey = getClientKey(request);

    const limitedByIp = await rateLimitResponse(`auth-register-ip:${ipKey}`, 5, 10 * 60_000);
    if (limitedByIp) return limitedByIp;

    const limitedByEmail = await rateLimitResponse(`auth-register-email:${emailKey}`, 1, 10 * 60_000);
    if (limitedByEmail) {
      return ok(
        { error: "Signup email already requested. Please wait a few minutes before trying again." },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const supabase = await createClient();
    const referralCode = body.referral_code?.trim().toUpperCase();
    const referralSuffix = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "";
    const { error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: referralCode ? { referral_code: referralCode } : undefined,
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(`/dashboard${referralSuffix}`)}`
      }
    });

    if (error) return authEmailError(error.message);

    return ok({ redirectTo: `/dashboard${referralSuffix}` });
  } catch (error) {
    return fail(error);
  }
}
