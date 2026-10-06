import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { promoteAllowlistedAdmin } from "@/lib/admin-email";
import { getBanStatusDetails } from "@/lib/ban-status";
import { ensureCustomerSetup } from "@/lib/customer-setup";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  await promoteAllowlistedAdmin(user);
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status !== "active") redirect("/dashboard");
  return { supabase, user, profile };
}

export type AdminPermission =
  | "can_manage_orders"
  | "can_manage_deposits"
  | "can_manage_referrals"
  | "can_manage_users"
  | "can_manage_wallets"
  | "can_manage_settings"
  | "can_manage_admins";

export async function requireAdminPermission(permission: AdminPermission) {
  const context = await requireAdmin();
  const email = context.user.email?.trim().toLowerCase();
  if (!email) redirect("/admin");

  const { data, error } = await context.supabase
    .from("admin_permissions")
    .select(permission)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Admin permission lookup failed", error);
    redirect("/admin");
  }

  const permissions = data as Partial<Record<AdminPermission, boolean>> | null;
  if (!permissions?.[permission]) redirect("/admin");
  return context;
}

export async function requireCustomer() {
  const { supabase, user } = await requireUser();
  if (await promoteAllowlistedAdmin(user)) redirect("/admin");
  const cookieStore = await cookies();
  await ensureCustomerSetup(supabase, user, cookieStore.get("dollerpay_referral")?.value);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.status === "banned") {
    const ban = await getBanStatusDetails({ userId: user.id, email: user.email });
    const search = ban.email ? `?email=${encodeURIComponent(ban.email)}` : "";
    redirect(`/banned${search}`);
  }
  return { supabase, user, profile };
}
