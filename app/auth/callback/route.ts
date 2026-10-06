import { NextResponse } from "next/server";
import { promoteAllowlistedAdmin } from "@/lib/admin-email";
import { getBanStatusDetails } from "@/lib/ban-status";
import { ensureCustomerSetup } from "@/lib/customer-setup";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=session", url.origin));
  }

  const promotedToAdmin = await promoteAllowlistedAdmin(user);

  if (promotedToAdmin) {
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  const ban = await getBanStatusDetails({ userId: user.id, email: user.email });
  if (ban.isBanned) {
    await supabase.auth.signOut();
    const bannedUrl = new URL("/banned", url.origin);
    if (ban.email) bannedUrl.searchParams.set("email", ban.email);
    return NextResponse.redirect(bannedUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  if (profile?.status === "banned") {
    return NextResponse.redirect(new URL("/banned", url.origin));
  }

  const nextUrl = new URL(next, url.origin);
  const metadataReferral = typeof user.user_metadata?.referral_code === "string" ? user.user_metadata.referral_code : null;
  await ensureCustomerSetup(supabase, user, url.searchParams.get("ref") ?? nextUrl.searchParams.get("ref") ?? metadataReferral);
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
