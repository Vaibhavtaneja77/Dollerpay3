import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldBan } from "lucide-react";
import { getBanStatusDetails } from "@/lib/ban-status";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function BannedPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const email = params.email?.trim().toLowerCase() ?? user?.email?.trim().toLowerCase() ?? null;
  const ban = await getBanStatusDetails({ userId: user?.id, email });

  if (!ban.isBanned) {
    redirect(user ? "/dashboard" : "/login");
  }

  const csrfToken = (await cookies()).get("dollerpay_csrf")?.value ?? "";

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <section className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-100 p-3 text-danger">
            <ShieldBan className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Account status</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">User is Banned</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This account cannot access the platform right now.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">Email</p>
          <p className="mt-1 break-all text-sm font-semibold text-zinc-900">{ban.email ?? email ?? "Unavailable"}</p>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase text-zinc-500">Reason</p>
          <p className="mt-1 text-sm leading-6 text-zinc-800">{ban.reason ?? "No ban reason was recorded."}</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form action="/auth/signout" method="post">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <Button type="submit">Sign out</Button>
          </form>
          <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-medium hover:bg-zinc-50">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
