import { redirect } from "next/navigation";
import Link from "next/link";
import { DepositProofForm } from "@/components/deposit-proof-form";
import { SellForm } from "@/components/sell-form";
import { requireCustomer } from "@/lib/auth";

export default async function SellPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireCustomer();
  const [{ data: wallet }, { data: settings }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    supabase.from("platform_settings_decrypted").select("*").eq("id", 1).single()
  ]);
  if (!settings) redirect("/dashboard");
  if (!wallet) redirect("/dashboard");
  const forceTopup = params.mode === "topup";

  return (
    <>
      {forceTopup ? (
        <div className="grid gap-4">
          <div className="flex justify-stretch sm:justify-end">
            <Link className="inline-flex h-10 w-full items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-zinc-50 sm:w-auto" href="/sell">
              Back to sell
            </Link>
          </div>
          <DepositProofForm adminWalletAddress={settings.admin_wallet_address} network={settings.supported_network} rate={settings.usdt_inr_rate} minDepositAmount={settings.min_deposit_amount ?? "25"} />
        </div>
      ) : (
        <SellForm
          rate={settings.usdt_inr_rate}
          balance={wallet.available_balance}
          maxAmount={settings.max_sell_amount}
        />
      )}
    </>
  );
}
