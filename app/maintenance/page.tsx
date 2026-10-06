import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-soft px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-ink">
          <Wrench className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Service maintenance</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          DollerPay is temporarily unavailable while an update is being completed. Please check again shortly.
        </p>
        <a className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-medium text-white" href="/dashboard">
          Try again
        </a>
      </section>
    </main>
  );
}
