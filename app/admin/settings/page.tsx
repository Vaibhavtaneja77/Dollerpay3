import { AdminManagement } from "@/components/admin-management";
import { CouponManagement } from "@/components/coupon-management";
import { SettingsForm } from "@/components/settings-form";
import { requireAdminPermission } from "@/lib/auth";

const permissionKeys = [
  "can_manage_orders",
  "can_manage_deposits",
  "can_manage_referrals",
  "can_manage_users",
  "can_manage_wallets",
  "can_manage_settings",
  "can_manage_admins"
] as const;

export default async function AdminSettingsPage() {
  const { supabase, user } = await requireAdminPermission("can_manage_settings");
  const [{ data: settings }, { data: coupons }, { data: allowlist }, { data: permissions }, { data: currentPermissions }] = await Promise.all([
    supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single(),
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("admin_email_allowlist").select("*").order("created_at", { ascending: false }),
    supabase.from("admin_permissions").select("*"),
    supabase.from("admin_permissions").select("can_manage_admins").eq("email", user.email?.trim().toLowerCase() ?? "").maybeSingle()
  ]);
  const permissionMap = new Map((permissions ?? []).map((row) => [row.email, row]));
  const admins = (allowlist ?? []).map((row) => {
    const permission = permissionMap.get(row.email);
    return {
      email: row.email,
      created_at: row.created_at,
      permissions: Object.fromEntries(permissionKeys.map((key) => [key, permission?.[key] ?? false])) as Record<(typeof permissionKeys)[number], boolean>
    };
  });

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <div className="grid gap-6">
        {settings ? <SettingsForm settings={settings} /> : null}
        <CouponManagement coupons={coupons ?? []} />
        {currentPermissions?.can_manage_admins ? <AdminManagement admins={admins} currentEmail={user.email} /> : null}
      </div>
    </>
  );
}
