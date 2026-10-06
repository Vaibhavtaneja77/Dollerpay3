import Link from "next/link";
import { AdminDepositActions } from "@/components/admin-deposit-actions";
import { AutoLoadMore } from "@/components/auto-load-more";
import { CountdownBadge } from "@/components/countdown-badge";
import { ProofPreview } from "@/components/proof-preview";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPermission } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_ASSET_BUCKET, PENDING_DEPOSIT_WINDOW_MS } from "@/lib/transaction-rules";
import { formatIstDateTime, formatUsdt } from "@/lib/utils";

export default async function AdminTransactionsPage({ searchParams }: { searchParams: Promise<{ limit?: string; status?: string }> }) {
  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 50), 300);
  await requireAdminPermission("can_manage_deposits");
  await syncPendingExpirations();
  const admin = createAdminClient();
  let query = admin
    .from("deposit_requests")
    .select("id,ticket_id,user_id,amount_usdt,network,proof_path,status,created_at,coupon_code,coupon_reward_usdt,profiles!deposit_requests_user_id_fkey(email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  const { data: deposits, error } = await query;
  const depositsWithProofs = await Promise.all(
    (deposits ?? []).map(async (deposit) => {
      const { data } = deposit.proof_path
        ? await admin.storage.from(PAYMENT_ASSET_BUCKET).createSignedUrl(deposit.proof_path, 60 * 10)
        : { data: null };
      const profile = Array.isArray(deposit.profiles) ? deposit.profiles[0] : deposit.profiles;
      return { ...deposit, userEmail: profile?.email ?? "Unknown", proofUrl: data?.signedUrl ?? null };
    })
  );
  const pendingCount = depositsWithProofs.filter((deposit) => deposit.status === "PENDING_DEPOSIT").length;

  return (
    <>
      <PageHeader title="Top-up Requests" description={`${pendingCount} pending verification${subtlePlural(pendingCount)}. Review transfer proofs and credit customer wallets once verified.`} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {["all", "PENDING_DEPOSIT", "DEPOSIT_CONFIRMED", "REJECTED"].map((status) => (
          <Link key={status} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-center text-sm font-medium shadow-sm hover:bg-zinc-50" href={`/admin/transactions?status=${status}`}>
            {status === "all" ? "All" : status.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><CardContent><p className="text-sm text-zinc-500">Pending</p><p className="mt-2 text-2xl font-semibold">{pendingCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-zinc-500">Confirmed</p><p className="mt-2 text-2xl font-semibold">{depositsWithProofs.filter((deposit) => deposit.status === "DEPOSIT_CONFIRMED").length}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-zinc-500">Rejected</p><p className="mt-2 text-2xl font-semibold">{depositsWithProofs.filter((deposit) => deposit.status === "REJECTED").length}</p></CardContent></Card>
      </section>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-danger">
          Could not load deposit requests: {error.message}
        </div>
      ) : null}
      {depositsWithProofs.length ? (
        <div className="rounded-lg border border-line bg-white shadow-soft">
          <div className="grid gap-3 p-3 lg:hidden">
            {depositsWithProofs.map((deposit) => (
              <div key={deposit.id} className="grid gap-3 rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="break-all font-mono text-sm font-semibold">{deposit.ticket_id}</span>
                  <StatusBadge status={deposit.status} label={deposit.status === "DEPOSIT_CONFIRMED" ? "Successfully Deposit" : undefined} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="User" value={deposit.userEmail} />
                  <Info label="Amount" value={formatUsdt(deposit.amount_usdt)} />
                  <Info label="Coupon" value={deposit.coupon_code ? `${deposit.coupon_code} (+${formatUsdt(deposit.coupon_reward_usdt)})` : "None"} />
                  <Info label="Network" value={deposit.network} />
                  <Info label="Created" value={formatIstDateTime(deposit.created_at)} />
                </div>
                <div className="grid gap-2">
                  {deposit.proofUrl ? (
                    <ProofPreview url={deposit.proofUrl} label="Preview proof" />
                  ) : (
                    <span className="text-sm text-zinc-500">Waiting for blockchain verification</span>
                  )}
                  {deposit.proof_path ? <p className="break-all font-mono text-xs text-zinc-400">{deposit.proof_path}</p> : null}
                </div>
                {deposit.status === "PENDING_DEPOSIT" ? (
                  <CountdownBadge
                    expiresAt={getExpiresAt(deposit.created_at, PENDING_DEPOSIT_WINDOW_MS)}
                    label="Verification countdown"
                    expiredLabel="Verifying, taking a little bit longer. Kindly wait patiently."
                  />
                ) : null}
                <AdminDepositActions depositId={deposit.id} disabled={deposit.status !== "PENDING_DEPOSIT"} />
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto lg:block">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="p-3">Ticket</th>
                <th>User email</th>
                <th>Amount</th>
                <th>Network</th>
                <th>Coupon</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {depositsWithProofs.map((deposit) => (
                <tr key={deposit.id} className="border-t border-line align-top">
                  <td className="p-3 font-mono">{deposit.ticket_id}</td>
                  <td>{deposit.userEmail}</td>
                  <td>{formatUsdt(deposit.amount_usdt)}</td>
                  <td>{deposit.network}</td>
                  <td>{deposit.coupon_code ? `${deposit.coupon_code} (+${formatUsdt(deposit.coupon_reward_usdt)})` : "None"}</td>
                  <td>
                    {deposit.proofUrl ? (
                      <ProofPreview url={deposit.proofUrl} label="Preview proof" />
                    ) : (
                      <span className="text-zinc-500">Blockchain verification</span>
                    )}
                    {deposit.proof_path ? <p className="mt-1 max-w-44 truncate font-mono text-xs text-zinc-400">{deposit.proof_path}</p> : null}
                  </td>
                  <td>
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={deposit.status} label={deposit.status === "DEPOSIT_CONFIRMED" ? "Successfully Deposit" : undefined} />
                      {deposit.status === "PENDING_DEPOSIT" ? (
                        <CountdownBadge
                          expiresAt={getExpiresAt(deposit.created_at, PENDING_DEPOSIT_WINDOW_MS)}
                          label="Verification countdown"
                          expiredLabel="Verifying, taking a little bit longer. Kindly wait patiently."
                        />
                      ) : null}
                    </div>
                  </td>
                  <td>{formatIstDateTime(deposit.created_at)}</td>
                  <td><AdminDepositActions depositId={deposit.id} disabled={deposit.status !== "PENDING_DEPOSIT"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No deposit proofs yet" description="Submitted customer top-up proofs will appear here for admin verification." />
      )}
      {depositsWithProofs.length >= limit && limit < 300 ? <AutoLoadMore href={`/admin/transactions?${new URLSearchParams({ ...(params.status ? { status: params.status } : {}), limit: String(limit + 50) }).toString()}`} /> : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-medium text-zinc-800">{value}</p>
    </div>
  );
}

function subtlePlural(count: number) {
  return count === 1 ? "" : "s";
}
