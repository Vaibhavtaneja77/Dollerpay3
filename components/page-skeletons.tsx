import { ListSkeleton } from "@/components/list-skeleton";

function HeaderSkeleton() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="h-8 w-44 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-zinc-100" />
    </div>
  );
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5 ${className}`}>
      <div className="h-4 w-1/3 rounded bg-zinc-200" />
      <div className="mt-4 grid gap-3">
        <div className="h-3 rounded bg-zinc-100" />
        <div className="h-3 w-4/5 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <section className="animate-pulse rounded-lg bg-ink p-4 shadow-soft sm:p-6">
        <div className="h-4 w-32 rounded bg-white/20" />
        <div className="mt-4 h-10 w-56 rounded bg-white/25" />
        <div className="mt-4 h-4 w-48 rounded bg-white/15" />
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

export function OrdersSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <ListSkeleton rows={6} />
    </>
  );
}

export function SellSkeleton() {
  return (
    <section className="mx-auto max-w-2xl animate-pulse rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <div className="h-7 w-36 rounded bg-zinc-200" />
      <div className="mt-6 grid gap-5">
        <CardSkeleton className="shadow-none" />
        <div className="h-12 rounded-xl bg-zinc-100" />
        <div className="h-12 rounded-xl bg-zinc-100" />
        <CardSkeleton className="shadow-none" />
        <div className="h-11 rounded-xl bg-zinc-200" />
      </div>
    </section>
  );
}

export function SettingsSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </>
  );
}

export function WalletSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <CardSkeleton />
    </>
  );
}

export function ReferralsSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CardSkeleton />
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
      <div className="mt-6">
        <ListSkeleton rows={4} />
      </div>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mx-auto grid max-w-4xl gap-6">
        <CardSkeleton />
        <ListSkeleton rows={3} />
      </div>
    </>
  );
}
