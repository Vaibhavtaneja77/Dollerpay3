import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { couponCreateSchema, couponDeleteSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = couponCreateSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_settings");
    const limited = await rateLimitResponse(`admin-coupons:${user.id}`, 20);
    if (limited) return limited;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("coupons")
      .insert({
        code: body.code,
        reward_usdt: body.reward_usdt,
        max_redemptions: body.max_redemptions,
        active: body.active,
        expires_at: body.expires_at ?? null,
        created_by: user.id
      })
      .select("*")
      .single();
    if (error) throw error;

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "COUPON_CREATED",
      entity_type: "coupon",
      entity_id: body.code,
      metadata: body
    });
    if (auditError) console.warn("Coupon audit log failed", auditError.message);
    return ok({ coupon: data }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = couponDeleteSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_settings");
    const limited = await rateLimitResponse(`admin-coupons-delete:${user.id}`, 20);
    if (limited) return limited;
    const admin = createAdminClient();

    const { error } = await admin.from("coupons").delete().eq("code", body.code);
    if (error) throw error;

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "COUPON_DELETED",
      entity_type: "coupon",
      entity_id: body.code,
      metadata: {}
    });
    if (auditError) console.warn("Coupon audit log failed", auditError.message);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
