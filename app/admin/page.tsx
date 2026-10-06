import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { formatInr, formatIstDateTime, formatUsdt } from "@/lib/utils";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  await syncPendingExpirations();
  const [{ count: totalUsers }, { count: activeUsers }, { count: pendingOrders }, { count: pendingDeposits }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["PENDING_DEPOSIT", "DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED", "PROCESSING_PAYOUT"]),
    supabase.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING_DEPOSIT"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8)
  ]);
  const volumeUsdt = orders?.reduce((sum, order) => sum + Number(order.amount_usdt), 0) ?? 0;
  const volumeInr = orders?.reduce((sum, order) => sum + Number(order.net_inr), 0) ?? 0;

  return (
    <>
      <PageHeader title="Action Queue" description="Monitor pending top-ups, payout orders, user volume, and the queues that need admin attention." />
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
        {[["Total Users", totalUsers ?? 0], ["Active Users", activeUsers ?? 0], ["Pending Orders", pendingOrders ?? 0], ["Pending Deposits", pendingDeposits ?? 0], ["USDT Volume", formatUsdt(volumeUsdt)], ["INR Volume", formatInr(volumeInr)]].map(([label, value]) => (
          <Card key={label} className="animate-fade-up"><CardContent><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>
        ))}
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/admin/transactions" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300">
          <p className="text-sm font-medium text-zinc-500">Internal wallet funding</p>
          <h2 className="mt-2 text-lg font-semibold">Review Top-ups</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{pendingDeposits ?? 0} proof{subtlePlural(pendingDeposits ?? 0)} waiting for verification.</p>
        </Link>
        <Link href="/admin/orders" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300">
          <p className="text-sm font-medium text-zinc-500">UPI, bank, and QR payouts</p>
          <h2 className="mt-2 text-lg font-semibold">Process Payouts</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{pendingOrders ?? 0} payout order{subtlePlural(pendingOrders ?? 0)} waiting for action.</p>
        </Link>
        <Link href="/admin/referrals" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300 md:col-span-2">
          <p className="text-sm font-medium text-zinc-500">Referral rewards</p>
          <h2 className="mt-2 text-lg font-semibold">Review referral payouts</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">See which referrers reached the 500 USDT threshold and mark manual payouts complete.</p>
        </Link>
      </section>

      <Card className="mt-6 animate-fade-up">
        <CardHeader><h2 className="font-semibold">Recent payout orders</h2></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {orders?.length ? orders.map((order) => (
              <Link href={`/admin/orders/${order.id}`} key={order.id} className="grid gap-2 rounded-xl border border-line p-4 hover:bg-zinc-50 md:grid-cols-5">
                <span className="font-mono text-sm">{order.ticket_id}</span>
                <span className="text-sm">{formatUsdt(order.amount_usdt)}</span>
                <span className="text-sm">{formatInr(order.net_inr)}</span>
                <StatusBadge status={order.status} />
                <span className="text-sm text-zinc-500">{formatIstDateTime(order.created_at)}</span>
              </Link>
            )) : <p className="text-sm text-zinc-600">No orders require attention right now.</p>}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function subtlePlural(count: number) {
  return count === 1 ? "" : "s";
}
