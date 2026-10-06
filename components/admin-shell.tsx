import Link from "next/link";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { AdminMobileBottomNav } from "@/components/admin-mobile-bottom-nav";
import { AdminMobileTopBar } from "@/components/admin-mobile-top-bar";
import { AdminNav } from "@/components/admin-nav";
import { BrowserNotifications } from "@/components/browser-notifications";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import { RouteTransitionIndicator } from "@/components/route-transition-indicator";
import { Button } from "@/components/ui/button";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const csrfToken = (await cookies()).get("dollerpay_csrf")?.value ?? "";
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 border-b border-line bg-ink text-white lg:static lg:min-h-screen lg:border-b-0 lg:border-r">
        <AdminMobileTopBar csrfToken={csrfToken} />
        <div className="hidden h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:flex">
          <Link href="/admin" className="min-w-0 truncate font-semibold tracking-tight">Admin Console</Link>
          <div className="flex items-center gap-2">
            <BrowserNotifications />
            <form action="/auth/signout" method="post">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <Button variant="ghost" className="hidden h-10 text-white hover:bg-white/10 lg:inline-flex" aria-label="Sign out"><LogOut className="h-4 w-4" />Sign out</Button>
            </form>
          </div>
        </div>
        <div className="hidden px-3 pb-3 lg:block lg:px-4 lg:pb-4">
          <AdminNav csrfToken={csrfToken} />
        </div>
      </aside>
      <main className="min-w-0 px-3 pb-28 pt-3 sm:px-4 sm:py-5 lg:p-8">{children}</main>
      <AdminMobileBottomNav />
      <RoutePrefetcher scope="admin" />
      <RouteTransitionIndicator />
    </div>
  );
}
