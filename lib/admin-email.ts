import { createAdminClient } from "@/lib/supabase/admin";

export async function promoteAllowlistedAdmin(user: { id: string; email?: string | null }) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;

  const admin = createAdminClient();
  const { data: allowlisted, error: allowlistError } = await admin
    .from("admin_email_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (allowlistError || !allowlisted) return false;

  await admin
    .from("admin_permissions")
    .upsert({
      email,
      can_manage_orders: true,
      can_manage_deposits: true,
      can_manage_referrals: true,
      can_manage_users: true,
      can_manage_wallets: true,
      can_manage_settings: true,
      can_manage_admins: true
    }, { onConflict: "email", ignoreDuplicates: true });

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      email,
      role: "admin",
      status: "active",
      onboarding_completed: true
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("Admin profile promotion failed", profileError);
    return false;
  }

  return true;
}
