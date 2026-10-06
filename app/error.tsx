"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCw } from "lucide-react";
import { ClientEventReporter } from "@/components/client-event-reporter";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <ClientEventReporter eventType="USER_SIDE_ERROR" message={error.message} digest={error.digest} />
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">The page could not be loaded. You can retry or return to the dashboard.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button className="w-full" type="button" onClick={reset}>
            <RotateCw className="h-4 w-4" aria-hidden />
            Retry
          </Button>
          <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-zinc-50" href="/dashboard">
            <Home className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
