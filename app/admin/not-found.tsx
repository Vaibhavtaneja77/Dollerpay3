"use client";

import Link from "next/link";
import { AlertTriangle, LayoutDashboard } from "lucide-react";
import { ClientEventReporter } from "@/components/client-event-reporter";

export default function AdminNotFound() {
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
      <ClientEventReporter eventType="USER_SIDE_NOT_FOUND" message="Admin route not found" />
      <div className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100">
          <AlertTriangle className="h-6 w-6 text-zinc-600" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Admin page not found</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">This admin page does not exist or is no longer available.</p>
        <Link className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white" href="/admin">
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          Admin Home
        </Link>
      </div>
    </section>
  );
}
