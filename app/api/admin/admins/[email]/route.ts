import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUpdateSchema } from "@/lib/validation";
import { createHash } from "crypto";

function hashAdminEmail(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ email: string }> }) {
  try {
    const { email: rawEmail } = await params;
    const email = decodeURIComponent(rawEmail).trim().toLowerCase();
    const body = adminUpdateSchema.parse(await request.json());
    const { user } = await requireAdminPermission("can_manage_admins");
    const limited = await rateLimitResponse(`admin-admin-update:${user.id}`, 20);
    if (limited) return limited;
    const admin = createAdminClient();

    const { error } = await admin
      .from("admin_permissions")
      .upsert({ email, ...body, updated_by: user.id });
    if (error) throw error;

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "ADMIN_PERMISSIONS_UPDATED",
      entity_type: "admin_email",
      entity_id: hashAdminEmail(email),
      metadata: body
    });

    return ok({ saved: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ email: string }> }) {
  try {
    const { email: rawEmail } = await params;
    const email = decodeURIComponent(rawEmail).trim().toLowerCase();
    const { user } = await requireAdminPermission("can_manage_admins");
    const limited = await rateLimitResponse(`admin-admin-delete:${user.id}`, 10);
    if (limited) return limited;
    const admin = createAdminClient();

    if (user.email?.trim().toLowerCase() === email) {
      return ok({ error: "You cannot remove your own admin access." }, { status: 422 });
    }

    const { error } = await admin.from("admin_email_allowlist").delete().eq("email", email);
    if (error) throw error;

    await admin
      .from("profiles")
      .update({ role: "customer", onboarding_completed: false })
      .eq("email", email)
      .eq("role", "admin");

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "ADMIN_REMOVED",
      entity_type: "admin_email",
      entity_id: hashAdminEmail(email),
      metadata: {}
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
