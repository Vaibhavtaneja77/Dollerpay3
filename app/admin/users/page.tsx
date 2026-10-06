import Link from "next/link";
import { AutoLoadMore } from "@/components/auto-load-more";
import { UserActions } from "@/components/user-actions";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUsdt, maskAccount } from "@/lib/utils";

type WalletRow = {
  id: string;
  address: string;
  available_balance: string;
  locked_balance?: string;
} | null;

function getWallet(value: WalletRow | WalletRow[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ limit?: string; q?: string }> }) {
  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 50), 300);
  await requireAdminPermission("can_manage_users");
  const admin = createAdminClient();
  let query = admin.from("profiles").select("id,email,full_name,role,status,onboarding_completed,created_at,wallets(id,address,available_balance,locked_balance)").order("created_at", { ascending: false }).limit(limit);
  if (params.q) query = query.ilike("email", `%${params.q.replace(/[%_]/g, "")}%`);
  const { data: users, error } = await query;
  return (
    <>
      <PageHeader title="Users" description="Review customer accounts, balances, and access state from one place." />
      <form className="mb-4 grid gap-2 rounded-lg border border-line bg-white p-3 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto]" action="/admin/users">
        <input className="h-10 rounded-lg border border-line px-3 text-sm" name="q" defaultValue={params.q ?? ""} placeholder="Search user email" />
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white" type="submit">Search</button>
      </form>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-danger">
          Could not load users: {error.message}
        </div>
      ) : null}
      {users?.length ? <div className="rounded-lg border border-line bg-white shadow-soft">
        <div className="grid gap-3 p-3 md:hidden">
          {users.map((user) => {
            const wallet = getWallet(user.wallets);
            return (
            <Link key={user.id} href={`/admin/users/${user.id}`} className="grid gap-3 rounded-lg border border-line p-4 hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-all text-sm font-semibold">{user.email}</p>
                <StatusBadge status={user.status.toUpperCase()} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Role" value={user.role} />
                <Info label="Wallet" value={maskAccount(wallet?.address)} mono />
                <Info label="Available" value={formatUsdt(wallet?.available_balance ?? "0")} />
                <Info label="Locked" value={formatUsdt(wallet?.locked_balance ?? "0")} />
              </div>
              <span className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">Open user</span>
            </Link>
          );})}
        </div>
        <div className="hidden overflow-auto md:block">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="p-3">User email</th><th>Role</th><th>Wallet</th><th>Available</th><th>Locked</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users?.map((user) => {
              const wallet = getWallet(user.wallets);
              return (
              <tr key={user.id} className="border-t border-line">
                <td className="p-3">
                  <p className="font-medium">{user.email}</p>
                  {user.full_name ? <p className="mt-1 text-xs text-zinc-500">{user.full_name}</p> : null}
                </td>
                <td className="capitalize">{user.role}</td>
                <td className="font-mono">{maskAccount(wallet?.address)}</td>
                <td>{formatUsdt(wallet?.available_balance ?? "0")}</td>
                <td>{formatUsdt(wallet?.locked_balance ?? "0")}</td>
                <td><StatusBadge status={user.status.toUpperCase()} /></td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Link className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-3 text-sm font-medium text-white" href={`/admin/users/${user.id}`}>Open user</Link>
                    <UserActions userId={user.id} status={user.status} />
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
        </div>
      </div> : <EmptyState title="No users found" description="Customer accounts will appear here after registration." />}
      {(users?.length ?? 0) >= limit && limit < 300 ? <AutoLoadMore href={`/admin/users?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), limit: String(limit + 50) }).toString()}`} /> : null}
    </>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 break-words font-medium text-zinc-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
