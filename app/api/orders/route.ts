import Decimal from "decimal.js-light";
import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { getSafeUploadExtension, rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_DEPOSIT_STATUSES, ACTIVE_ORDER_STATUSES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, PAYMENT_ASSET_BUCKET } from "@/lib/transaction-rules";
import { orderCreateSchema } from "@/lib/validation";
import { makeTicketId } from "@/lib/utils";

const allowedOrderQrTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const DIGITAL_ERUPEE_METHOD_ID = "digital-erupee";

export async function GET() {
  try {
    const { supabase, user } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const { data, error } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return ok({ orders: data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let orderQr: File | null = null;
    let rawBody: unknown;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      rawBody = {
        amount_usdt: form.get("amount_usdt"),
        payment_method_id: form.get("payment_method_id"),
        idempotency_key: form.get("idempotency_key"),
        qr_holder_name: form.get("qr_holder_name")
      };
      const file = form.get("order_qr");
      orderQr = file instanceof File ? file : null;
    } else {
      rawBody = await request.json();
    }
    const body = orderCreateSchema.parse(rawBody);
    const { supabase, user, profile } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const limited = await rateLimitResponse(`orders:${user.id}`, 8);
    if (limited) return limited;
    if (profile?.status !== "active") throw new Error("User account is not active");

    const { data: settings, error: settingsError } = await supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single();
    if (settingsError) throw settingsError;
    if (settings.maintenance_mode) throw new Error("Platform maintenance mode is active");

    const amount = new Decimal(body.amount_usdt);
    if (amount.gt(settings.max_sell_amount)) {
      throw new Error("Amount is outside platform limits");
    }

    const { data: existing } = await supabase.from("orders").select("id,ticket_id").eq("idempotency_key", body.idempotency_key).eq("user_id", user.id).maybeSingle();
    if (existing) return ok({ order_id: existing.id, ticket_id: existing.ticket_id });

    const [{ data: activeOrders, error: activeOrdersError }, { data: activeDeposits, error: activeDepositsError }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,ticket_id,status")
        .eq("user_id", user.id)
        .in("status", ACTIVE_ORDER_STATUSES)
        .limit(1),
      supabase
        .from("deposit_requests_decrypted")
        .select("id,ticket_id,status")
        .eq("user_id", user.id)
        .in("status", ACTIVE_DEPOSIT_STATUSES)
        .limit(1)
    ]);
    if (activeOrdersError) throw activeOrdersError;
    if (activeDepositsError) throw activeDepositsError;

    const activeOrder = activeOrders?.[0];
    const activeDeposit = activeDeposits?.[0];

    if (activeOrder || activeDeposit) {
      return ok(
        {
          error: "You already have an active order. Please wait until it is completed before placing another.",
          code: "ACTIVE_ORDER_EXISTS",
          active_order_id: activeOrder?.id ?? activeDeposit?.id,
          active_ticket_id: activeOrder?.ticket_id ?? activeDeposit?.ticket_id,
          active_order_type: activeOrder ? "sell" : "deposit"
        },
        { status: 422 }
      );
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id,available_balance,locked_balance")
      .eq("user_id", user.id)
      .single();
    if (walletError) throw walletError;
    if (new Decimal(wallet.available_balance).lt(amount)) {
      return ok(
        {
          error: "Insufficient USDT balance for this sell order.",
          code: "INSUFFICIENT_BALANCE",
          available_balance: wallet.available_balance,
          required_amount: body.amount_usdt
        },
        { status: 422 }
      );
    }

    if (body.payment_method_id !== DIGITAL_ERUPEE_METHOD_ID) {
      return ok({ error: "Only Digital Erupee payouts are supported right now." }, { status: 422 });
    }

    let orderQrPath: string | null = null;
    const admin = createAdminClient();
    if (!body.qr_holder_name) return ok({ error: "Enter the Digital Erupee QR holder name." }, { status: 422 });
    if (!(orderQr instanceof File) || orderQr.size === 0) return ok({ error: "Upload your Digital Erupee QR for this order." }, { status: 422 });
    if (!allowedOrderQrTypes.has(orderQr.type)) return ok({ error: "Upload a PNG, JPG, or WEBP Digital Erupee QR image." }, { status: 422 });
    if (orderQr.size > MAX_UPLOAD_BYTES) return ok({ error: `Digital Erupee QR image must be ${MAX_UPLOAD_MB} MB or smaller.` }, { status: 422 });

    const extension = getSafeUploadExtension(orderQr, allowedOrderQrTypes);
    if (!extension) return ok({ error: "Digital Erupee QR file extension must match the uploaded image type." }, { status: 422 });
    orderQrPath = `payment-methods/${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(PAYMENT_ASSET_BUCKET)
      .upload(orderQrPath, orderQr, { contentType: orderQr.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase.rpc("create_sell_order", {
      p_ticket_id: makeTicketId(),
      p_amount_usdt: body.amount_usdt,
      p_payment_method_id: null,
      p_idempotency_key: body.idempotency_key
    });
    if (error) {
      if (orderQrPath) await admin.storage.from(PAYMENT_ASSET_BUCKET).remove([orderQrPath]);
      throw error;
    }

    if (orderQrPath) {
      const { data: order } = await admin.from("orders").select("payment_method_snapshot").eq("id", data).eq("user_id", user.id).single();
      const snapshot = typeof order?.payment_method_snapshot === "object" && order.payment_method_snapshot
        ? order.payment_method_snapshot
        : {};
      const { error: snapshotError } = await admin
        .from("orders")
        .update({ payment_method_snapshot: { ...snapshot, qr_path: orderQrPath, qr_scope: "order", qr_holder_name: body.qr_holder_name } })
        .eq("id", data)
        .eq("user_id", user.id);
      if (snapshotError) {
        await admin.storage.from(PAYMENT_ASSET_BUCKET).remove([orderQrPath]);
        throw snapshotError;
      }
    }

    const { data: created } = await supabase.from("orders").select("id,ticket_id").eq("id", data).eq("user_id", user.id).maybeSingle();
    return ok({ order_id: data, ticket_id: created?.ticket_id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
