import { CountdownBadge } from "@/components/countdown-badge";
import { CopyButton } from "@/components/copy-button";
import { OrdersRefreshButton } from "@/components/orders-refresh-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Copy } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_ASSET_BUCKET, PENDING_DEPOSIT_WINDOW_MS } from "@/lib/transaction-rules";
import { formatIstDateTime, formatUsdt } from "@/lib/utils";

export default async function DepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireCustomer();
  await syncPendingExpirations(user.id);
  const { data: deposit } = await supabase
    .from("deposit_requests_decrypted")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const admin = createAdminClient();
  const { data: settings } = await supabase.from("platform_settings_decrypted").select("admin_wallet_qr_path").eq("id", 1).single();
  const qrPath = settings && "admin_wallet_qr_path" in settings ? settings.admin_wallet_qr_path : null;
  const qrUrl = qrPath
    ? (await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(qrPath, 60 * 45)).data?.signedUrl ?? null
    : null;

  return (
    <>
      <PageHeader
        title="Top-up Details"
        description="Track your USDT top-up payment window and verification status."
        backHref="/orders"
        actions={<OrdersRefreshButton />}
      />
      <div className="mx-auto grid max-w-4xl gap-6">
        <Card className="animate-fade-up">
          <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl">USDT Top-up</h1>
              <p className="mt-2 break-all font-mono text-sm text-zinc-600">{deposit?.ticket_id ?? id}</p>
              {deposit?.status === "PENDING_DEPOSIT" ? (
                <div className="mt-3">
                  <CountdownBadge
                    expiresAt={getExpiresAt(deposit.created_at, PENDING_DEPOSIT_WINDOW_MS)}
                    label="Verification countdown"
                    expiredLabel="Verifying, taking a little bit longer. Kindly wait patiently."
                  />
                </div>
              ) : null}
            </div>
            {deposit ? <StatusBadge status={deposit.status} label={deposit.status === "DEPOSIT_CONFIRMED" ? "Successfully Deposit" : undefined} /> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Deposit ID" value={deposit?.id ?? ""} mono />
              <Info label="Amount" value={formatUsdt(deposit?.amount_usdt ?? "0")} />
              <Info label="Coupon" value={deposit?.coupon_code ? `${deposit.coupon_code} (+${formatUsdt(deposit.coupon_reward_usdt)})` : "None"} />
              <Info label="Network" value={deposit?.network ?? ""} />
              <Info label="Created" value={deposit ? formatIstDateTime(deposit.created_at) : ""} />
              <Info label="Verified" value={deposit?.verified_at ? formatIstDateTime(deposit.verified_at) : "Not verified yet"} />
              <Info label="Payment wallet" value={deposit?.admin_wallet_address ?? ""} mono />
            </div>

            {deposit?.status === "PENDING_DEPOSIT" ? (
              <div className="grid gap-4 rounded-lg border border-line bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Send only {deposit.network}</p>
                    <p className="mt-1 text-sm text-zinc-600">Wait up to 15 minutes after payment. It will be automatically verified on blockchain.</p>
                  </div>
                  <CountdownBadge
                    expiresAt={getExpiresAt(deposit.created_at, PENDING_DEPOSIT_WINDOW_MS)}
                    label="Time left"
                    expiredLabel="Verifying, taking a little bit longer. Kindly wait patiently."
                  />
                </div>
                {qrUrl ? (
                  <img className="mx-auto aspect-square w-full max-w-64 rounded-lg border border-line bg-white object-contain p-3" src={qrUrl} alt="Admin payment wallet QR code" />
                ) : null}
                <div className="rounded-lg border border-line bg-white p-4">
                  <p className="text-xs font-medium uppercase text-zinc-500">Wallet address</p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm text-zinc-700">{deposit.admin_wallet_address}</p>
                    <CopyButton value={deposit.admin_wallet_address} label="Copy payment wallet"><Copy className="h-4 w-4" /></CopyButton>
                  </div>
                </div>
                <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800">
                  Sending another crypto or using a wrong network can lead to permanent loss.
                </p>
              </div>
            ) : null}

            {deposit?.admin_notes ? <Notice title="Verification note" value={deposit.admin_notes} /> : null}
            {deposit?.rejection_reason ? <Notice title="Rejection reason" value={deposit.rejection_reason} danger /> : null}

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
      <p className={`mt-1 break-words text-sm font-semibold ${mono ? "break-all font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Notice({ title, value, danger }: { title: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${danger ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-zinc-50 text-zinc-700"}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{value}</p>
    </div>
  );
}
