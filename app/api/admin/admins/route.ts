import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateSchema } from "@/lib/validation";
import { createHash } from "crypto";

function hashAdminEmail(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = adminCreateSchema.parse(await request.json());
    const { user } = await requireAdminPermission("can_manage_admins");
    const limited = await rateLimitResponse(`admin-admin-create:${user.id}`, 10);
    if (limited) return limited;
    const admin = createAdminClient();

    const { email, ...permissions } = body;
    const { error: allowError } = await admin
      .from("admin_email_allowlist")
      .insert({ email, created_by: user.id });
    if (allowError && allowError.code !== "23505") throw allowError;

    const { error: permissionError } = await admin
      .from("admin_permissions")
      .upsert({ email, ...permissions, updated_by: user.id });
    if (permissionError) throw permissionError;

    await admin.from("profiles").update({ role: "admin", status: "active", onboarding_completed: true }).eq("email", email);
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "ADMIN_ADDED",
      entity_type: "admin_email",
      entity_id: hashAdminEmail(email),
      metadata: permissions
    });

    return ok({ saved: true });
  } catch (error) {
    return fail(error);
  }
}
