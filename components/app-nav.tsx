"use client";

import Link from "next/link";
import { Gift, LogOut, Menu, Settings, UserCircle2, Wallet, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TelegramSupportLink } from "@/components/telegram-support-link";
import { UsdtLogo } from "@/components/usdt-logo";
import { cn } from "@/lib/utils";

const desktopLinks = [
  { href: "/dashboard", label: "Dashboard", icon: WalletCards },
  { href: "/orders", label: "Orders", icon: Wallet },
  { href: "/referrals", label: "Referrals", icon: Gift },
  { href: "/wallet", label: "Wallet", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Account", icon: UserCircle2 }
] as const;

const mobileMenuLinks = [
  { href: "/referrals", label: "Referrals", icon: Gift },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Account", icon: UserCircle2 }
] as const;

export function AppNav({ csrfToken }: { csrfToken?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex">
        {desktopLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
              isActive(href)
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button className="fixed inset-0 z-40 cursor-default lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <div className="fixed left-3 right-3 top-[4.5rem] z-50 animate-scale-in rounded-lg border border-line bg-white p-3 shadow-soft lg:hidden">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-zinc-50 px-3 py-3">
              <UsdtLogo className="h-8 w-8" />
              <span className="text-base font-semibold tracking-tight text-ink">DollerPay</span>
            </Link>
            <div className="grid gap-2">
              <TelegramSupportLink
                className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700 hover:bg-sky-100"
                label="Telegram support"
                onClick={() => setOpen(false)}
              />
              {mobileMenuLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
                    isActive(href)
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "border border-line text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              ))}
              {csrfToken ? (
                <form action="/auth/signout" method="post">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button
                    className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-danger"
                    type="submit"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Logout
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
