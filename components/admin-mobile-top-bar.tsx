"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";

function adminTitle(pathname: string) {
  if (pathname.startsWith("/admin/orders/")) return "Order review";
  if (pathname === "/admin/orders") return "Payouts";
  if (pathname === "/admin/transactions") return "Top-ups";
  if (pathname === "/admin/referrals") return "Referrals";
  if (pathname === "/admin/users") return "Users";
  if (pathname === "/admin/audit") return "Audit logs";
  if (pathname === "/admin/settings") return "Settings";
  return "Admin";
}

export function AdminMobileTopBar({ csrfToken }: { csrfToken: string }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/admin";

  return (
    <div className="flex h-16 items-center justify-between gap-3 px-3 lg:hidden">
      <div className="w-10">
        {isDashboard ? (
          <AdminNav csrfToken={csrfToken} />
        ) : (
          <Link
            href="/admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-sm active:scale-95"
            aria-label="Back to admin dashboard"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-normal text-white">{adminTitle(pathname)}</p>
      <div className="w-10" />
    </div>
  );
}
