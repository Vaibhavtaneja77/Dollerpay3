import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitResponse } from "@/lib/security";
import { syncPendingExpirations } from "@/lib/expirations";
import { ACTIVE_DEPOSIT_STATUSES, MIN_TRANSACTION_USDT, PAYMENT_ASSET_BUCKET } from "@/lib/transaction-rules";
import { depositCreateSchema } from "@/lib/validation";
import { formatUsdt, makeTicketId } from "@/lib/utils";

export async function GET() {
  try {
    const { supabase, user } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const { data, error } = await supabase
      .from("deposit_requests_decrypted")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok({ deposits: data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const limited = await rateLimitResponse(`deposits:${user.id}`, 6);
    if (limited) return limited;

    const form = await request.formData();
    const body = depositCreateSchema.parse({ amount_usdt: form.get("amount_usdt"), coupon_code: form.get("coupon_code") });

    const [{ data: wallet }, { data: settings }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single()
    ]);

    if (!wallet) throw new Error("Wallet not found");
    if (!settings) throw new Error("Platform settings are not configured");
    const minimumDeposit = Math.max(Number(settings.min_deposit_amount ?? MIN_TRANSACTION_USDT), Number(MIN_TRANSACTION_USDT));

    if (Number(body.amount_usdt) < minimumDeposit) {
      return ok({ error: `Minimum deposit amount is ${formatUsdt(minimumDeposit)}.` }, { status: 422 });
    }

    const { data: activeDeposits, error: activeDepositsError } = await supabase
      .from("deposit_requests_decrypted")
      .select("id,ticket_id,status")
      .eq("user_id", user.id)
      .in("status", ACTIVE_DEPOSIT_STATUSES)
      .limit(1);
    if (activeDepositsError) throw activeDepositsError;

    const activeDeposit = activeDeposits?.[0];

    if (activeDeposit) {
      return ok(
        {
          error: "You already have a pending top-up order. Please wait until it is completed before creating another top-up.",
          code: "ACTIVE_TOPUP_EXISTS",
          active_order_id: activeDeposit.id,
          active_ticket_id: activeDeposit.ticket_id,
          active_order_type: "deposit"
        },
        { status: 422 }
      );
    }

    const admin = createAdminClient();
    const { data: depositId, error } = await admin.rpc("create_deposit_request", {
      p_ticket_id: makeTicketId().replace("USDT-", "DEP-"),
      p_user_id: user.id,
      p_wallet_id: wallet.id,
      p_amount_usdt: body.amount_usdt,
      p_network: settings.supported_network,
      p_admin_wallet_address: settings.admin_wallet_address,
      p_proof_path: null,
      p_coupon_code: body.coupon_code ? body.coupon_code.toUpperCase() : null
    });
    if (error) throw error;

    const { data, error: depositError } = await admin
      .from("deposit_requests_decrypted")
      .select("*")
      .eq("id", depositId)
      .eq("user_id", user.id)
      .single();
    if (depositError) throw depositError;

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "DEPOSIT_REQUEST_CREATED",
      entity_type: "deposit_request",
      entity_id: data.id,
      metadata: { amount_usdt: body.amount_usdt, coupon_code: body.coupon_code }
    });
    if (auditError) console.warn("Deposit audit log failed", auditError.message);

    const qrPath = "admin_wallet_qr_path" in settings ? settings.admin_wallet_qr_path : null;
    const qrUrl = qrPath
      ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(qrPath, 60 * 45)).data?.signedUrl ?? null
      : null;

    return ok({ deposit: data, payment: { qrUrl, walletAddress: settings.admin_wallet_address, network: settings.supported_network } }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
