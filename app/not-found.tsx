"use client";

import Link from "next/link";
import { AlertTriangle, Home, ListChecks } from "lucide-react";
import { ClientEventReporter } from "@/components/client-event-reporter";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <ClientEventReporter eventType="USER_SIDE_NOT_FOUND" message="Route not found" />
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100">
          <AlertTriangle className="h-6 w-6 text-zinc-600" aria-hidden />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase text-zinc-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">This page does not exist or the link is no longer available.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white" href="/dashboard">
            <Home className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-zinc-50" href="/orders">
            <ListChecks className="h-4 w-4" aria-hidden />
            Orders
          </Link>
        </div>
      </section>
    </main>
  );
}
