import type { User } from "@supabase/supabase-js";

function walletAddress(userId: string) {
  return `INT-USDT-${userId.slice(0, 8).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function ensureCustomerSetup(
  supabase: any,
  user: User,
  referralCode?: string | null
) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,status,onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin" || profile?.status === "banned") return;

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      email,
      full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
      role: "customer",
      status: "active",
      onboarding_completed: true
    });
  } else if (!profile.onboarding_completed) {
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  }

  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).maybeSingle();
  if (!wallet) {
    await supabase.from("wallets").insert({
      user_id: user.id,
      address: walletAddress(user.id),
      available_balance: "0",
      locked_balance: "0",
      status: "active"
    });
  }

  if (referralCode) {
    const { error } = await supabase.rpc("register_referral", {
      p_referral_code: referralCode.trim().toUpperCase(),
      p_referred_user_id: user.id
    });
    if (error) console.warn("Referral registration skipped", error.message);
  }
}
