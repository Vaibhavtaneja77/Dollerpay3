import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_ASSET_BUCKET } from "@/lib/transaction-rules";
import { getSafeUploadExtension, rateLimitResponse } from "@/lib/security";
import { settingsSchema } from "@/lib/validation";
import type { z } from "zod";

const allowedQrTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET() {
  try {
    const { supabase } = await requireAdminPermission("can_manage_settings");
    const { data, error } = await supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single();
    if (error) throw error;
    return ok({ settings: data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdminPermission("can_manage_settings");
    const limited = await rateLimitResponse(`admin-settings:${user.id}`, 10);
    if (limited) return limited;
    const contentType = request.headers.get("content-type") ?? "";
    let body: z.infer<typeof settingsSchema>;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = settingsSchema.parse({
        usdt_inr_rate: form.get("usdt_inr_rate"),
        platform_fee_percent: form.get("platform_fee_percent"),
        min_sell_amount: form.get("min_sell_amount"),
        min_deposit_amount: form.get("min_deposit_amount"),
        max_sell_amount: form.get("max_sell_amount"),
        admin_wallet_address: form.get("admin_wallet_address"),
        supported_network: form.get("supported_network"),
        processing_message: form.get("processing_message"),
        maintenance_mode: form.get("maintenance_mode") === "true"
      });

      const qr = form.get("admin_wallet_qr");
      if (qr instanceof File && qr.size > 0) {
        const extension = getSafeUploadExtension(qr, allowedQrTypes);
        if (!extension) return ok({ error: "Upload a PNG, JPG, or WEBP QR image." }, { status: 422 });
        const admin = createAdminClient();
        const qrPath = `settings/admin-wallet-qr/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await admin.storage
          .from(PAYMENT_ASSET_BUCKET)
          .upload(qrPath, qr, { contentType: qr.type, upsert: false });
        if (uploadError) throw uploadError;
        body.admin_wallet_qr_path = qrPath;
      }
    } else {
      body = settingsSchema.parse(await request.json());
    }

    const { error } = await supabase.from("platform_settings").update(body).eq("id", 1);
    if (error) throw error;
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "SETTINGS_UPDATED",
      entity_type: "platform_settings",
      entity_id: "1",
      metadata: {
        usdt_inr_rate: body.usdt_inr_rate,
        platform_fee_percent: body.platform_fee_percent,
        min_sell_amount: body.min_sell_amount,
        min_deposit_amount: body.min_deposit_amount,
        max_sell_amount: body.max_sell_amount,
        supported_network: body.supported_network,
        processing_message: body.processing_message,
        maintenance_mode: body.maintenance_mode,
        admin_wallet_address_updated: Boolean(body.admin_wallet_address),
        admin_wallet_qr_updated: Boolean(body.admin_wallet_qr_path)
      }
    });
    return ok({ saved: true });
  } catch (error) {
    return fail(error);
  }
}
