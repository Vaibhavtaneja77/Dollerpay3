"use client";

import Link from "next/link";
import { BarChart3, Gift, LogOut, Menu, ScrollText, Settings, Users, WalletCards, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/orders", label: "Payouts", icon: WalletCards },
  { href: "/admin/transactions", label: "Top-ups", icon: WalletCards },
  { href: "/admin/referrals", label: "Referrals", icon: Gift },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings }
] as const;

export function AdminNav({ csrfToken }: { csrfToken?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const navContent = (
    <nav className="grid gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            "inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition",
            isActive(href)
              ? "border-white/10 bg-white text-ink shadow-sm"
              : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/8 hover:text-white"
          )}
        >
          <Icon className={cn("h-4 w-4", isActive(href) ? "text-ink" : "text-zinc-400")} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <div className="hidden lg:block">{navContent}</div>
      <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin navigation">
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="mx-3 mt-16 animate-scale-in rounded-2xl border border-white/10 bg-ink p-3 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-400">Admin navigation</p>
              <button className="rounded-full p-2 text-zinc-300 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close admin navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">{navContent}</div>
            {csrfToken ? (
              <form className="mt-3" action="/auth/signout" method="post">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-medium text-red-100" type="submit">
                  <LogOut className="h-4 w-4" aria-hidden />
                  Logout
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
