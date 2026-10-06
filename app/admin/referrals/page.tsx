import Link from "next/link";
import { AdminReferralActions } from "@/components/admin-referral-actions";
import { AutoLoadMore } from "@/components/auto-load-more";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { formatInr, formatIstDate, formatUsdt, maskAccount } from "@/lib/utils";

type PaymentMethod = {
  type: "upi" | "bank" | "qr";
  display_name: string | null;
  upi_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  qr_path: string | null;
};

type ReferralAdminRow = {
  id: string;
  status: string;
  reward_amount_inr: string;
  qualified_deposit_amount_usdt: string | null;
  created_at: string;
  qualified_at: string | null;
  rejection_reason: string | null;
  referrer: ReferralProfile | ReferralProfile[] | null;
  referred: ReferralProfile | ReferralProfile[] | null;
};

type ReferralProfile = {
  id?: string;
  full_name: string | null;
  email: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ limit?: string; status?: string }> }) {
  const { limit: rawLimit, status } = await searchParams;
  const limit = Math.min(Math.max(Number(rawLimit ?? 50), 50), 300);
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("referrals")
    .select("id,status,reward_amount_inr,qualified_deposit_amount_usdt,created_at,qualified_at,rejection_reason,referrer:profiles!referrals_referrer_id_fkey(id,full_name,email),referred:profiles!referrals_referred_user_id_fkey(id,full_name,email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status && status !== "all") query = query.eq("status", status);
  const { data: referrals, error } = await query;

  const normalizedReferrals = (referrals as ReferralAdminRow[] | null)?.map((referral) => ({
    ...referral,
    referrer: firstRelation(referral.referrer),
    referred: firstRelation(referral.referred)
  })) ?? [];

  const referrerIds = Array.from(new Set(normalizedReferrals.map((item) => item.referrer?.id).filter(Boolean))) as string[];
  const { data: paymentMethods } = referrerIds.length
    ? await supabase.from("payment_methods").select("user_id,type,display_name,upi_id,bank_name,account_number,qr_path,is_default").in("user_id", referrerIds).eq("is_default", true)
    : { data: [] as any[] };
  const methodMap = new Map<string, PaymentMethod>();
  for (const method of paymentMethods ?? []) {
    methodMap.set(method.user_id, method);
  }

  return (
    <>
      <PageHeader title="Referral Rewards" description="Review referred accounts that reached the qualifying deposit threshold, then manually pay the reward to the referrer's current default payout method." />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {["all", "READY_FOR_PAYOUT", "REGISTERED", "PAID", "REJECTED"].map((item) => (
          <Link key={item} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-center text-sm font-medium shadow-sm hover:bg-zinc-50" href={`/admin/referrals?status=${item}`}>
            {item === "all" ? "All" : item.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      {error ? (
        <EmptyState title="Could not load referral rewards" description={error.message} />
      ) : normalizedReferrals.length ? (
        <div className="rounded-lg border border-line bg-white shadow-soft">
          <div className="grid gap-3 p-3 xl:hidden">
            {normalizedReferrals.map((referral) => {
              const referrer = referral.referrer;
              const referred = referral.referred;
              const method = referrer?.id ? methodMap.get(referrer.id) : undefined;
              return (
                <div key={referral.id} className="grid gap-3 rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <ReferralIdentity label="Refer By" profile={referrer} />
                      <p className="mt-1 text-xs text-zinc-500">Referred on {formatIstDate(referral.created_at)}</p>
                    </div>
                    <StatusBadge status={referral.status} />
                  </div>
                  {referral.rejection_reason ? <p className="text-xs leading-5 text-danger">{referral.rejection_reason}</p> : null}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ReferralIdentity label="Refer User" profile={referred} />
                    <Info label="Deposits" value={referral.qualified_deposit_amount_usdt ? formatUsdt(referral.qualified_deposit_amount_usdt) : "Not qualified"} />
                    <Info label="Reward" value={formatInr(referral.reward_amount_inr)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-zinc-500">Default payout method</p>
                    <div className="mt-2">{method ? <PaymentMethodSummary method={method} /> : <span className="text-sm text-zinc-500">No default method</span>}</div>
                  </div>
                  <AdminReferralActions referralId={referral.id} status={referral.status} />
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-auto xl:block">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="p-4">Refer By</th>
                <th>Refer User</th>
                <th>Status</th>
                <th>Deposits</th>
                <th>Reward</th>
                <th>Default payout method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {normalizedReferrals.map((referral) => {
                const referrer = referral.referrer;
                const referred = referral.referred;
                const method = referrer?.id ? methodMap.get(referrer.id) : undefined;
                return (
                  <tr key={referral.id} className="border-t border-line align-top">
                    <td className="p-4">
                      <ReferralIdentity profile={referrer} />
                      <p className="mt-1 text-xs text-zinc-500">Referred on {formatIstDate(referral.created_at)}</p>
                    </td>
                    <td><ReferralIdentity profile={referred} /></td>
                    <td>
                      <StatusBadge status={referral.status} />
                      {referral.rejection_reason ? <p className="mt-2 max-w-xs text-xs leading-5 text-danger">{referral.rejection_reason}</p> : null}
                    </td>
                    <td>{referral.qualified_deposit_amount_usdt ? formatUsdt(referral.qualified_deposit_amount_usdt) : "Not qualified"}</td>
                    <td>{formatInr(referral.reward_amount_inr)}</td>
                    <td>
                      {method ? <PaymentMethodSummary method={method} /> : <span className="text-zinc-500">No default method</span>}
                    </td>
                    <td><AdminReferralActions referralId={referral.id} status={referral.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No referral records yet" description="Referred signups and reward states will appear here for manual payout review." />
      )}
      {normalizedReferrals.length >= limit && limit < 300 ? <AutoLoadMore href={`/admin/referrals?${new URLSearchParams({ ...(status ? { status } : {}), limit: String(limit + 50) }).toString()}`} /> : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-medium text-zinc-800">{value}</p>
    </div>
  );
}

function ReferralIdentity({ label, profile }: { label?: string; profile: ReferralProfile | null }) {
  return (
    <div className="min-w-0">
      {label ? <p className="text-xs font-medium uppercase text-zinc-500">{label}</p> : null}
      <p className="mt-1 break-words font-medium text-zinc-800">{profile?.full_name ?? "Unknown user"}</p>
      <p className="mt-1 break-all text-xs text-zinc-500">{profile?.email ?? "Unknown email"}</p>
    </div>
  );
}

function PaymentMethodSummary({ method }: { method: PaymentMethod }) {
  if (method.type === "upi") return <p className="font-medium text-zinc-700">{method.upi_id}</p>;
  if (method.type === "qr") {
    return (
      <div className="grid gap-2">
        <p className="font-medium text-zinc-700">Digital Erupee</p>
        <p className="text-xs leading-5 text-zinc-500">QR is uploaded per sell order.</p>
      </div>
    );
  }
  return <p className="font-medium text-zinc-700">{method.bank_name} • {maskAccount(method.account_number)}</p>;
}
