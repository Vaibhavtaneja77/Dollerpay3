"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppNav } from "@/components/app-nav";

function pageTitle(pathname: string, topup: boolean) {
  if (pathname.startsWith("/orders/deposits/")) return "Top-up details";
  if (pathname.startsWith("/orders/")) return "Order details";
  if (pathname === "/orders") return "Orders";
  if (pathname === "/sell") return topup ? "Top up" : "Sell";
  if (pathname === "/wallet") return "Wallet";
  if (pathname === "/referrals") return "Referrals";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/profile") return "Account";
  return "DollerPay";
}

function backHref(pathname: string, topup: boolean) {
  if (pathname.startsWith("/orders/deposits/") || pathname.startsWith("/orders/")) return "/orders";
  if (pathname === "/sell" && topup) return "/sell";
  if (pathname !== "/dashboard") return "/dashboard";
  return null;
}

export function MobileTopBar({ csrfToken }: { csrfToken: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topup = searchParams.get("mode") === "topup";
  const href = backHref(pathname, topup);

  return (
    <>
      <div className="flex items-center">
        {href ? (
          <Link
            href={href}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
        ) : (
          <AppNav csrfToken={csrfToken} />
        )}
      </div>
      <div className="min-w-0 text-center lg:hidden">
        <p className="truncate text-sm font-semibold tracking-normal text-ink">{pageTitle(pathname, topup)}</p>
      </div>
    </>
  );
}
