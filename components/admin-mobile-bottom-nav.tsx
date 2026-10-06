"use client";

import Link from "next/link";
import { BarChart3, Settings, Users, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Home", icon: BarChart3 },
  { href: "/admin/orders", label: "Payouts", icon: WalletCards },
  { href: "/admin/transactions", label: "Top-ups", icon: WalletCards },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "More", icon: Settings }
] as const;

export function AdminMobileBottomNav() {
  const pathname = usePathname();
  const settingsActive = pathname === "/admin/settings" || pathname === "/admin/audit" || pathname === "/admin/referrals";

  return (
    <nav className="fixed bottom-4 left-1/2 z-40 grid w-[min(94vw,430px)] -translate-x-1/2 grid-cols-5 rounded-[2rem] border border-white/70 bg-white/86 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.18)] backdrop-blur-xl lg:hidden" aria-label="Admin mobile navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin"
          ? pathname === href
          : href === "/admin/settings"
            ? settingsActive
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "grid min-w-0 place-items-center gap-0.5 rounded-full px-1.5 py-2 text-[10px] font-semibold text-zinc-500",
              active ? "bg-ink text-white shadow-sm" : "hover:bg-white"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
