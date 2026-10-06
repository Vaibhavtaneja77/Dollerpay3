import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const referralCode = url.searchParams.get("ref");
  const referralSuffix = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "";
  const next = `/dashboard${referralSuffix}`;
  const redirectTo = new URL(`/auth/callback?next=${encodeURIComponent(next)}`, url.origin);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth_start", url.origin));
  }

  return NextResponse.redirect(data.url);
}
