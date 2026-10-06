import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { formatUsdt } from "@/lib/utils";

export default async function WalletPage() {
  const { supabase, user } = await requireCustomer();
  const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
  return (
    <>
      <PageHeader title="Wallet" description="View your internal wallet address and current available versus locked USDT balances." backHref="/dashboard" />
      <Card className="animate-fade-up">
        <CardHeader><h1 className="text-xl font-semibold sm:text-2xl">Wallet</h1></CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">Internal wallet address</p>
            <p className="mt-2 break-all font-mono text-sm">{wallet?.address}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4"><p className="text-sm text-zinc-500">Available</p><p className="mt-2 break-words text-xl font-semibold sm:text-2xl">{formatUsdt(wallet?.available_balance ?? "0")}</p></div>
            <div className="rounded-xl border border-line p-4"><p className="text-sm text-zinc-500">Locked</p><p className="mt-2 break-words text-xl font-semibold sm:text-2xl">{formatUsdt(wallet?.locked_balance ?? "0")}</p></div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
