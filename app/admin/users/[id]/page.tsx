import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminWalletAdjustment } from "@/components/admin-wallet-adjustment";
import { UserActions } from "@/components/user-actions";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInr, formatIstDateTime, formatUsdt, maskAccount } from "@/lib/utils";

type WalletRow = {
  id: string;
  address: string;
  available_balance: string;
  locked_balance: string;
  status: string;
  created_at: string;
} | null;

function getWallet(value: WalletRow | WalletRow[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPermission("can_manage_users");
  const admin = createAdminClient();
  const [{ data: user }, { data: orders }, { data: deposits }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,email,full_name,role,status,onboarding_completed,created_at,wallets(id,address,available_balance,locked_balance,status,created_at)")
      .eq("id", id)
      .maybeSingle(),
    admin.from("orders").select("id,ticket_id,amount_usdt,net_inr,status,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    admin.from("deposit_requests").select("id,ticket_id,amount_usdt,status,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10)
  ]);

  if (!user) notFound();
  const wallet = getWallet(user.wallets);
  const { data: ledger } = wallet
    ? await admin.from("wallet_ledger").select("id,type,amount,balance_before,balance_after,reference_type,created_at").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(12)
    : { data: [] };

  return (
    <>
      <PageHeader title="User details" description={user.email} backHref="/admin/users" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-all text-lg font-semibold">{user.email}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{user.full_name ?? "No profile name"}</p>
                </div>
                <StatusBadge status={user.status.toUpperCase()} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Role" value={user.role} />
                <Info label="Account setup" value={user.onboarding_completed ? "Ready" : "Pending"} />
                <Info label="Joined" value={formatIstDateTime(user.created_at)} />
                <Info label="User ID" value={user.id} mono />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Recent payout orders</h2></CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {orders?.length ? orders.map((order) => (
                  <Link href={`/admin/orders/${order.id}`} key={order.id} className="grid gap-2 rounded-lg border border-line p-3 hover:bg-zinc-50 sm:grid-cols-4">
                    <span className="font-mono text-sm">{order.ticket_id}</span>
                    <span className="text-sm">{formatUsdt(order.amount_usdt)}</span>
                    <span className="text-sm">{formatInr(order.net_inr)}</span>
                    <StatusBadge status={order.status} />
                  </Link>
                )) : <p className="text-sm text-zinc-600">No payout orders found.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Recent top-ups</h2></CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {deposits?.length ? deposits.map((deposit) => (
                  <div key={deposit.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-3">
                    <span className="font-mono text-sm">{deposit.ticket_id}</span>
                    <span className="text-sm">{formatUsdt(deposit.amount_usdt)}</span>
                    <StatusBadge status={deposit.status} label={deposit.status === "DEPOSIT_CONFIRMED" ? "Successfully Deposit" : undefined} />
                  </div>
                )) : <p className="text-sm text-zinc-600">No top-ups found.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><h2 className="font-semibold">Wallet control</h2></CardHeader>
            <CardContent>
              {wallet ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 text-sm">
                    <Info label="Wallet" value={maskAccount(wallet.address)} mono />
                    <Info label="Available" value={formatUsdt(wallet.available_balance)} />
                    <Info label="Locked" value={formatUsdt(wallet.locked_balance)} />
                    <Info label="Status" value={wallet.status} />
                  </div>
                  <AdminWalletAdjustment walletId={wallet.id} />
                </div>
              ) : (
                <p className="text-sm text-zinc-600">This user does not have a wallet yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Access control</h2></CardHeader>
            <CardContent><UserActions userId={user.id} status={user.status} /></CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Wallet ledger</h2></CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {ledger?.length ? ledger.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{entry.type}</span>
                      <span>{formatUsdt(entry.amount)}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{formatIstDateTime(entry.created_at)}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatUsdt(entry.balance_before)} to {formatUsdt(entry.balance_after)}</p>
                  </div>
                )) : <p className="text-sm text-zinc-600">No wallet ledger entries yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 break-words font-medium text-zinc-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
