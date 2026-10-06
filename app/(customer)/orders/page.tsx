import Link from "next/link";
import { ClipboardList, Plus, Send } from "lucide-react";
import { CountdownBadge } from "@/components/countdown-badge";
import { OrdersRefreshButton } from "@/components/orders-refresh-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustomer } from "@/lib/auth";
import { getExpiresAt } from "@/lib/countdown";
import { syncPendingExpirations } from "@/lib/expirations";
import { PENDING_DEPOSIT_WINDOW_MS, PENDING_WITHDRAWAL_WINDOW_MS } from "@/lib/transaction-rules";
import { formatInr, formatIstDateTime, formatUsdt } from "@/lib/utils";

export default async function OrdersPage() {
  const { supabase, user } = await requireCustomer();
  await syncPendingExpirations(user.id);
  const [{ data: orders }, { data: deposits }] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("deposit_requests_decrypted").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);
  const items = [
    ...(orders ?? []).map((order) => ({ ...order, kind: "Sell" as const, amount: formatUsdt(order.amount_usdt), value: formatInr(order.net_inr), href: `/orders/${order.id}` })),
    ...(deposits ?? []).map((deposit) => ({ ...deposit, kind: "Deposit" as const, amount: formatUsdt(deposit.amount_usdt), value: deposit.network, href: `/orders/deposits/${deposit.id}` }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <>
      <PageHeader
        title="Orders"
        description="Track your wallet top-ups and INR payout orders in one place, including pending timers and final outcomes."
        backHref="/dashboard"
        actions={
          <>
            <OrdersRefreshButton />
            <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-zinc-50" href="/sell?mode=topup"><Plus className="h-4 w-4" />Top up</Link>
            <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-sm font-medium text-white hover:bg-zinc-800" href="/sell"><Send className="h-4 w-4" />Sell</Link>
          </>
        }
      />
      {items.length ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          {items.map((item) => (
            <Link key={`${item.kind}-${item.id}`} href={item.href} className="grid gap-3 border-b border-line p-4 transition last:border-b-0 hover:bg-zinc-50 md:grid-cols-6 md:items-center md:gap-2">
              <div className="flex items-start justify-between gap-3 md:block">
                <span className="text-sm font-semibold">{item.kind === "Deposit" ? "USDT Top-up" : "INR Payout"}</span>
                <span className="md:hidden"><StatusBadge status={item.status} label={getDisplayStatusLabel(item.kind, item.status)} /></span>
              </div>
              <span className="break-all font-mono text-sm">{item.ticket_id}</span>
              <div className="grid grid-cols-2 gap-3 md:contents">
                <div>
                  <span className="text-xs font-medium uppercase text-zinc-500 md:hidden">Amount</span>
                  <p className="text-sm">{item.amount}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-zinc-500 md:hidden">Value</span>
                  <p className="text-sm">{item.value}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:items-start">
                <span className="hidden md:block"><StatusBadge status={item.status} label={getDisplayStatusLabel(item.kind, item.status)} /></span>
                {item.status === "PENDING_DEPOSIT" ? (
                  <CountdownBadge
                    expiresAt={getExpiresAt(item.created_at, item.kind === "Deposit" ? PENDING_DEPOSIT_WINDOW_MS : PENDING_WITHDRAWAL_WINDOW_MS)}
                    label={item.kind === "Deposit" ? "Verification countdown" : "Payout countdown"}
                    expiredLabel={item.kind === "Deposit" ? "Verifying, taking a little bit longer. Kindly wait patiently." : "Processing, taking a little bit longer. Kindly wait patiently."}
                  />
                ) : null}
              </div>
              <span className="text-sm text-zinc-500">{formatIstDateTime(item.created_at)}</span>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No orders yet" description="Your completed and pending wallet top-ups and payout orders will appear here." action={<Link className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white" href="/sell?mode=topup"><ClipboardList className="h-4 w-4" />Top up USDT</Link>} />}
    </>
  );
}

function getDisplayStatusLabel(kind: "Sell" | "Deposit", status: string) {
  if (kind === "Deposit" && status === "DEPOSIT_CONFIRMED") return "Successfully Deposit";
  return undefined;
}
