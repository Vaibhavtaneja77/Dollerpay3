"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RotateCw } from "lucide-react";
import { ClientEventReporter } from "@/components/client-event-reporter";
import { Button } from "@/components/ui/button";

export default function AdminErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
      <ClientEventReporter eventType="USER_SIDE_ERROR" message={error.message} digest={error.digest} />
      <div className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Admin page error</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">The page could not be loaded. Retry or return to the admin dashboard.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button className="w-full" type="button" onClick={reset}>
            <RotateCw className="h-4 w-4" aria-hidden />
            Retry
          </Button>
          <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-zinc-50" href="/admin">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Admin Home
          </Link>
        </div>
      </div>
    </section>
  );
}
