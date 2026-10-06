"use client";

import Link from "next/link";
import { ArrowLeftRight, Home, ListChecks, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/orders", label: "Orders", icon: ListChecks },
  { href: "/sell", label: "Sell", icon: ArrowLeftRight },
  { href: "/wallet", label: "Wallet", icon: WalletCards }
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-40 grid w-[min(92vw,390px)] -translate-x-1/2 grid-cols-4 rounded-[2rem] border border-white/70 bg-white/82 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.16)] backdrop-blur-xl lg:hidden" aria-label="Primary mobile navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "grid min-w-0 place-items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-semibold text-zinc-500",
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
