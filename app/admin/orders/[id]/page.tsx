import { AdminOrderActions } from "@/components/admin-order-actions";
import { CountdownBadge } from "@/components/countdown-badge";
import { ProofPreview } from "@/components/proof-preview";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdminPermission } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { getOrderStatusDetail } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_ASSET_BUCKET, PENDING_WITHDRAWAL_WINDOW_MS } from "@/lib/transaction-rules";
import { formatUsdt } from "@/lib/utils";

type PaymentSnapshot = {
  type?: "upi" | "bank" | "qr";
  display_name?: string | null;
  upi_id?: string | null;
  qr_path?: string | null;
  qr_holder_name?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number_masked?: string | null;
  ifsc?: string | null;
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminPermission("can_manage_orders");
  await syncPendingExpirations();
  const { data: order } = await supabase.from("orders").select("*, profiles!orders_user_id_fkey(email)").eq("id", id).single();

  const payment = (order?.payment_method_snapshot ?? {}) as PaymentSnapshot;
  const paymentInfo = payment.type === "upi"
    ? payment.upi_id || "UPI not available"
    : payment.type === "qr"
      ? "Digital Erupee"
      : [payment.bank_name, payment.account_number_masked].filter(Boolean).join(" • ") || "Bank details not available";
  const admin = createAdminClient();
  const qrUrl = payment.type === "qr" && payment.qr_path
    ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(payment.qr_path, 60 * 10)).data?.signedUrl ?? null
    : null;
  const payoutProofUrl = order?.payment_proof_path
    ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(order.payment_proof_path, 60 * 10)).data?.signedUrl ?? null
    : null;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="animate-fade-up">
          <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl">Order Review</h1>
              <p className="mt-2 text-sm text-zinc-600">{getOrderStatusDetail(order?.status ?? "")}</p>
              {order?.status === "PENDING_DEPOSIT" ? (
                <div className="mt-3">
                  <CountdownBadge
                    expiresAt={getExpiresAt(order.created_at, PENDING_WITHDRAWAL_WINDOW_MS)}
                    label="Payout countdown"
                    expiredLabel="Processing, taking a little bit longer. Kindly wait patiently."
                  />
                </div>
              ) : null}
            </div>
            {order ? <StatusBadge status={order.status} /> : null}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="User email" value={order?.profiles?.email ?? "Unknown"} />
              <Info label="Order ID" value={order?.id ?? ""} mono />
              <Info label="Order type" value="Sell USDT" />
              <Info label="Status" value={order?.status ?? ""} />
              <Info label="Queue" value={order ? `#${order.queue_position}` : ""} />
              <Info label="Amount" value={formatUsdt(order?.amount_usdt ?? "0")} />
              <Info label="Rate" value={`Rs ${order?.rate ?? "0"} / USDT`} />
              <Info label="Payment Info" value={paymentInfo} mono={payment.type === "upi"} />
              {payment.type === "qr" ? <Info label="QR holder" value={payment.qr_holder_name ?? "Not provided"} /> : null}
            </div>
            {payment.type === "qr" && qrUrl ? (
              <div className="mt-4 rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">Digital Erupee QR for this order</p>
                <img className="mt-3 aspect-square w-full max-w-64 rounded-lg border border-line bg-white object-contain p-3" src={qrUrl} alt="Customer Digital Erupee QR for this order" />
              </div>
            ) : null}
            {payoutProofUrl ? (
              <div className="mt-4 rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">Payout proof</p>
                <div className="mt-3">
                  <ProofPreview url={payoutProofUrl} label="Preview payout proof" />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader>
            <h2 className="font-semibold">Order Actions</h2>
          </CardHeader>
          <CardContent>
            {order ? <AdminOrderActions orderId={order.id} status={order.status} /> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${mono ? "break-all font-mono" : ""}`}>{value}</p>
    </div>
  );
}
