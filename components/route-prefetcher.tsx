"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const customerRoutes = ["/dashboard", "/orders", "/sell", "/sell?mode=topup", "/wallet", "/settings", "/referrals"] as const;
const adminRoutes = ["/admin", "/admin/orders", "/admin/transactions", "/admin/users", "/admin/settings"] as const;

export function RoutePrefetcher({ scope }: { scope: "customer" | "admin" }) {
  const router = useRouter();

  useEffect(() => {
    const routes = scope === "admin" ? adminRoutes : customerRoutes;
    const prefetch = () => routes.forEach((route) => router.prefetch(route));
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetch, { timeout: 1600 });
    } else {
      timeoutId = setTimeout(prefetch, 700);
    }

    return () => {
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, scope]);

  return null;
}
