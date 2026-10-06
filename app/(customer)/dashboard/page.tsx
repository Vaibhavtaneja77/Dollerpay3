import Link from "next/link";
import { Gift, Plus, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrdersRefreshButton } from "@/components/orders-refresh-button";
import { requireCustomer } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { formatInr, formatUsdt, multiplyMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, user } = await requireCustomer();
  await syncPendingExpirations(user.id);
  const [{ data: wallet }, { data: settings }, { data: orders }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single(),
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);

  return (
    <div className="grid gap-6">
        <section className="animate-fade-up rounded-lg bg-ink p-4 text-white shadow-soft sm:p-6">
          <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-sm text-zinc-400">Available Balance</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-normal sm:text-4xl">{formatInr(multiplyMoney(wallet?.available_balance ?? "0", settings?.usdt_inr_rate ?? "0"))}</h1>
              <p className="mt-3 text-sm text-zinc-300">Current purchasing price: ₹{settings?.usdt_inr_rate ?? "0"} / USDT</p>
              <p className="mt-1 text-sm text-zinc-400">≈ {formatUsdt(wallet?.available_balance ?? "0")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <OrdersRefreshButton />
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink shadow-sm hover:bg-zinc-200 sm:px-4" href="/sell?mode=topup">
                <Plus className="h-4 w-4" aria-hidden />Top up
              </Link>
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-medium text-white shadow-sm hover:bg-white/15 sm:px-4" href="/sell">
                <Send className="h-4 w-4" aria-hidden />Sell to INR
              </Link>
            </div>
          </div>
          {/* {wallet ? (
            <div className="mt-6 flex max-w-xl items-center justify-between rounded-md border border-white/10 bg-white/5 p-3">
              <span className="truncate font-mono text-sm text-zinc-200">{wallet.address}</span>
              <CopyButton value={wallet.address} label="Copy wallet address"><Copy className="h-4 w-4" /></CopyButton>
            </div>
          ) : null} */}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/sell?mode=topup" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300">
            <p className="text-sm font-medium text-zinc-500">Step 1</p>
            <h2 className="mt-2 text-lg font-semibold">Top up INR value</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Enter the USDT amount, create an order, and pay using the wallet QR shown on the next step.</p>
          </Link>
          <Link href="/sell" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300">
            <p className="text-sm font-medium text-zinc-500">Step 2</p>
            <h2 className="mt-2 text-lg font-semibold">Sell USDT to INR</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">After top-up approval, upload your Digital Erupee QR and place a sell order.</p>
          </Link>
          <Link href="/referrals" className="rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-zinc-300">
            <p className="text-sm font-medium text-zinc-500">Referral rewards</p>
            <h2 className="mt-2 text-lg font-semibold">Invite and earn</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Share your link and earn referral payouts when invited users qualify.</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink">
              <Gift className="h-4 w-4" aria-hidden />
              Open referrals
            </div>
          </Link>
        </section>

        <Card className="animate-fade-up">
          <CardHeader><h2 className="font-semibold">Recent INR payout orders</h2></CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {orders?.length ? orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="grid gap-2 rounded-md border border-line p-4 hover:border-zinc-300 hover:bg-zinc-50 sm:grid-cols-4">
                  <span className="break-all font-mono text-sm">{order.ticket_id}</span>
                  <span className="text-sm">{formatInr(order.net_inr)}</span>
                  <span className="text-sm">{formatUsdt(order.amount_usdt)}</span>
                  <span className="text-sm font-medium">{order.status.replaceAll("_", " ")}</span>
                </Link>
              )) : <p className="text-sm text-zinc-600">You haven't sold any USDT yet.</p>}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
