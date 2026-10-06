import Link from "next/link";
import { AutoLoadMore } from "@/components/auto-load-more";
import { CountdownBadge } from "@/components/countdown-badge";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPermission } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { getOrderStatusLabel } from "@/lib/order-status";
import { PENDING_WITHDRAWAL_WINDOW_MS } from "@/lib/transaction-rules";
import { formatInr, formatIstDateTime, formatUsdt } from "@/lib/utils";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; limit?: string }> }) {
  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 50), 300);
  const { supabase } = await requireAdminPermission("can_manage_orders");
  await syncPendingExpirations();
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.q) query = query.ilike("ticket_id", `%${params.q.replace(/[%_]/g, "")}%`);
  const { data: orders } = await query;
  return (
    <>
      <PageHeader title="Payout Orders" description="Review payout requests, watch pending timers, and move valid orders through the payout workflow." />
      <form className="mb-4 grid gap-2 rounded-lg border border-line bg-white p-3 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto]" action="/admin/orders">
        <input className="h-10 rounded-lg border border-line px-3 text-sm" name="q" defaultValue={params.q ?? ""} placeholder="Search ticket ID" />
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white" type="submit">Search</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
          {["all", "PENDING_DEPOSIT", "PROCESSING_PAYOUT", "COMPLETED", "REJECTED"].map((status) => (
            <Link key={status} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-center text-sm font-medium hover:bg-zinc-50" href={`/admin/orders?status=${status}`}>{status === "all" ? "All" : getOrderStatusLabel(status)}</Link>
          ))}
      </div>
      {orders?.length ? <div className="rounded-lg border border-line bg-white shadow-soft">
        <div className="grid gap-3 p-3 md:hidden">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-3 rounded-lg border border-line p-4 hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <span className="break-all font-mono text-sm font-semibold">{order.ticket_id}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="USDT" value={formatUsdt(order.amount_usdt)} />
                <Info label="INR payout" value={formatInr(order.net_inr)} />
                <Info label="Next action" value={nextPayoutAction(order.status)} />
                <Info label="Created" value={formatIstDateTime(order.created_at)} />
              </div>
              {order.status === "PENDING_DEPOSIT" ? (
                <CountdownBadge
                  expiresAt={getExpiresAt(order.created_at, PENDING_WITHDRAWAL_WINDOW_MS)}
                  label="Payout countdown"
                  expiredLabel="Processing, taking a little bit longer. Kindly wait patiently."
                />
              ) : null}
            </Link>
          ))}
        </div>
        <div className="hidden overflow-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr><th className="p-3">Ticket</th><th>USDT</th><th>INR payout</th><th>Status</th><th>Next action</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders?.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="p-3 font-mono">{order.ticket_id}</td>
                <td>{formatUsdt(order.amount_usdt)}</td>
                <td>{formatInr(order.net_inr)}</td>
                <td>
                  <div className="flex flex-col gap-2">
                    <StatusBadge status={order.status} />
                    {order.status === "PENDING_DEPOSIT" ? (
                      <CountdownBadge
                        expiresAt={getExpiresAt(order.created_at, PENDING_WITHDRAWAL_WINDOW_MS)}
                        label="Payout countdown"
                        expiredLabel="Processing, taking a little bit longer. Kindly wait patiently."
                      />
                    ) : null}
                  </div>
                </td>
                <td>{nextPayoutAction(order.status)}</td>
                <td>{formatIstDateTime(order.created_at)}</td>
                <td><Link className="font-medium hover:underline" href={`/admin/orders/${order.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div> : <EmptyState title="No payout orders found" description="When customers create payout requests, they will appear here for review." />}
      {(orders?.length ?? 0) >= limit && limit < 300 ? (
        <AutoLoadMore href={`/admin/orders?${new URLSearchParams({ ...(params.status ? { status: params.status } : {}), ...(params.q ? { q: params.q } : {}), limit: String(limit + 50) }).toString()}`} />
      ) : null}
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

function nextPayoutAction(status: string) {
  if (["PENDING_DEPOSIT", "DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED"].includes(status)) return "Process payout";
  if (["PROCESSING_PAYOUT", "PAYOUT_SENT"].includes(status)) return "Upload proof and complete";
  if (status === "COMPLETED") return "Done";
  if (status === "REJECTED") return "Rejected";
  return "Review";
}
