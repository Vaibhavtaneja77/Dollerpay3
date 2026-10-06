import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CountdownBadge } from "@/components/countdown-badge";
import { OrdersRefreshButton } from "@/components/orders-refresh-button";
import { ProofPreview } from "@/components/proof-preview";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustomer } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { getOrderStatusDetail } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_ASSET_BUCKET, PENDING_WITHDRAWAL_WINDOW_MS } from "@/lib/transaction-rules";
import { formatInr, formatIstDateTime, formatUsdt } from "@/lib/utils";

type PaymentSnapshot = {
  type?: "upi" | "bank" | "qr";
  display_name?: string | null;
  upi_id?: string | null;
  qr_path?: string | null;
  qr_holder_name?: string | null;
  bank_name?: string | null;
  account_number_masked?: string | null;
};

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireCustomer();
  await syncPendingExpirations(user.id);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).single();
  const payment = (order?.payment_method_snapshot ?? {}) as PaymentSnapshot;
  const admin = createAdminClient();
  const qrUrl = payment.type === "qr" && payment.qr_path
    ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(payment.qr_path, 60 * 10)).data?.signedUrl ?? null
    : null;
  const payoutProofUrl = order?.payment_proof_path
    ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(order.payment_proof_path, 60 * 10)).data?.signedUrl ?? null
    : null;
  const paymentValue = payment.type === "upi"
    ? payment.upi_id ?? "UPI not available"
    : payment.type === "qr"
      ? "Digital Erupee"
      : [payment.bank_name, payment.account_number_masked].filter(Boolean).join(" • ") || "Bank details not available";

  return (
    <>
      <PageHeader title="Order Details" description="Review payout status, verification updates, and final transfer receipt." backHref="/orders" actions={<OrdersRefreshButton />} />
      <div className="mx-auto grid max-w-4xl gap-6">
        {query.created === "1" ? (
          <Card className="border-success/30 bg-green-50">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-success">Order created successfully</p>
              <p className="mt-2 text-sm text-green-800">Your payment is being verified. You’ll receive confirmation shortly.</p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="animate-fade-up">
          <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl">Order Details</h1>
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
              <Info label="Order ID" value={order?.id ?? ""} mono />
              <Info label="Order type" value="Sell USDT" />
              <Info label="Status" value={order?.status ?? ""} />
              <Info label="Queue no" value={order ? `#${order.queue_position}` : ""} />
              <Info label="Amount" value={formatUsdt(order?.amount_usdt ?? "0")} />
              <Info label="Rate" value={`Rs ${order?.rate ?? "0"} / USDT`} />
              <Info label="Gross" value={formatInr(order?.gross_inr ?? "0")} />
              <Info label="Payment method" value={paymentValue} mono={payment.type === "upi"} />
              {payment.type === "qr" ? <Info label="QR holder" value={payment.qr_holder_name ?? "Not provided"} /> : null}
              <Info label="Completed" value={order?.completed_at ? formatIstDateTime(order.completed_at) : "Not completed yet"} />
            </div>
            {order?.admin_notes ? <Notice title="Verification note" value={order.admin_notes} /> : null}
            {order?.rejection_reason ? <Notice title="Rejection reason" value={order.rejection_reason} danger /> : null}
            {payment.type === "qr" && qrUrl ? (
              <div className="mt-4 rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">Digital Erupee QR for this order</p>
                <img className="mt-3 aspect-square w-full max-w-56 rounded-lg border border-line bg-white object-contain p-3" src={qrUrl} alt="Digital Erupee QR for this order" />
              </div>
            ) : null}
            {payoutProofUrl ? (
              <div className="mt-4 rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">Payout receipt</p>
                <div className="mt-3">
                  <ProofPreview url={payoutProofUrl} label="Preview payout receipt" />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Notice({ title, value, danger }: { title: string; value: string; danger?: boolean }) {
  return (
    <div className={`mt-4 rounded-lg border p-4 text-sm ${danger ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-zinc-50 text-zinc-700"}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{value}</p>
    </div>
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
