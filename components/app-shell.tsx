import Link from "next/link";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { BrowserNotifications } from "@/components/browser-notifications";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import { RouteTransitionIndicator } from "@/components/route-transition-indicator";
import { TelegramSupportLink } from "@/components/telegram-support-link";
import { Button } from "@/components/ui/button";
import { UsdtLogo } from "@/components/usdt-logo";
import { createClient } from "@/lib/supabase/server";
import { formatUsdt } from "@/lib/utils";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const csrfToken = (await cookies()).get("dollerpay_csrf")?.value ?? "";
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { data: wallet } = data.user
    ? await supabase.from("wallets").select("available_balance").eq("user_id", data.user.id).maybeSingle()
    : { data: null };
  const walletBalance = formatUsdt(wallet?.available_balance ?? "0");
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-xl lg:bg-paper">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4 lg:flex lg:justify-between lg:gap-4">
          <div className="contents lg:hidden">
            <MobileTopBar csrfToken={csrfToken} />
          </div>

          <Link href="/dashboard" className="hidden min-w-0 items-center gap-2 text-base font-semibold tracking-tight lg:inline-flex lg:justify-self-auto">
            <UsdtLogo className="h-8 w-8 text-xl" />
            <span className="truncate">DollerPay</span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <AppNav csrfToken={csrfToken} />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <BrowserNotifications />
            </div>
            <form action="/auth/signout" method="post">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <Button variant="ghost" className="hidden h-10 w-10 rounded-xl px-0 sm:inline-flex" aria-label={`Sign out ${data.user?.email ?? ""}`}><LogOut className="h-4 w-4" /></Button>
            </form>
            <Link href="/wallet" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-2 text-xs font-semibold text-ink shadow-sm sm:px-3 sm:text-sm" aria-label={`Wallet balance ${walletBalance}`}>
              <UsdtLogo className="h-6 w-6 shrink-0 text-base" />
              <span className="whitespace-nowrap">{walletBalance}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 pb-28 pt-3 sm:px-4 sm:py-8 lg:pt-8">{children}</main>
      <MobileBottomNav />
      <TelegramSupportLink
        className="fixed bottom-6 right-6 z-40 hidden rounded-full bg-sky-500 px-4 py-3 text-sm text-white shadow-[0_18px_45px_rgba(14,165,233,.32)] hover:bg-sky-600 lg:inline-flex"
        label="@Dollerpay1122"
      />
      <RoutePrefetcher scope="customer" />
      <RouteTransitionIndicator />
    </div>
  );
}
