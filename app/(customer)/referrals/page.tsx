import { headers } from "next/headers";
import { Gift, HandCoins, Link2, Users } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { requireCustomer } from "@/lib/auth";
import { buildReferralLink, REFERRAL_MAX_BENEFITS, REFERRAL_QUALIFY_DEPOSIT_USDT, REFERRAL_REWARD_INR } from "@/lib/referrals";
import { formatInr, formatIstDate, formatUsdt } from "@/lib/utils";

type ReferralRow = {
  id: string;
  status: string;
  reward_amount_inr: string;
  qualified_deposit_amount_usdt: string | null;
  created_at: string;
  qualified_at: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
  referred: { email: string | null } | { email: string | null }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ReferralsPage() {
  const { supabase, user, profile } = await requireCustomer();
  const { data: referrals } = await supabase
    .from("referrals")
    .select("id,status,reward_amount_inr,qualified_deposit_amount_usdt,created_at,qualified_at,paid_at,rejection_reason,referred:profiles!referrals_referred_user_id_fkey(email)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const referralLink = buildReferralLink(`${proto}://${host}`, profile?.referral_code ?? "");
  const normalizedReferrals = ((referrals as ReferralRow[] | null) ?? []).map((referral) => ({
    ...referral,
    referred: firstRelation(referral.referred)
  }));
  const paidCount = normalizedReferrals.filter((item) => item.status === "PAID").length;
  const readyCount = normalizedReferrals.filter((item) => item.status === "READY_FOR_PAYOUT").length;
  const totalEarned = normalizedReferrals.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.reward_amount_inr), 0);

  return (
    <>
      <PageHeader title="Referrals" description={`Share your referral link and earn ₹${REFERRAL_REWARD_INR} when a referred user signs up with your link and reaches ${formatUsdt(REFERRAL_QUALIFY_DEPOSIT_USDT)} in confirmed deposits. Benefits are capped at ${REFERRAL_MAX_BENEFITS} successful referrals.`} backHref="/dashboard" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-zinc-500" aria-hidden />
            <h2 className="text-lg font-semibold">Your referral link</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Send this link to new users. The referral will attach when they register through it and complete their first qualifying deposits.</p>
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-all text-sm font-medium text-zinc-700">{referralLink}</p>
            <CopyButton value={referralLink} label="Copy referral link">Copy link</CopyButton>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <SummaryCard icon={<Users className="h-5 w-5 text-zinc-500" aria-hidden />} label="Total referrals" value={String(normalizedReferrals.length)} />
          <SummaryCard icon={<HandCoins className="h-5 w-5 text-emerald-600" aria-hidden />} label="Ready for payout" value={String(readyCount)} />
          <SummaryCard icon={<Gift className="h-5 w-5 text-ink" aria-hidden />} label="Total earned" value={formatInr(totalEarned)} />
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Referred users</h2>
          <p className="mt-1 text-sm text-zinc-600">Track each referred user's email and whether that account has qualified for the ₹{REFERRAL_REWARD_INR} reward.</p>
        </div>
        {normalizedReferrals.length ? (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {normalizedReferrals.map((referral) => (
                <div key={referral.id} className="grid gap-3 rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-all text-sm font-semibold text-zinc-800">{referral.referred?.email ?? "Unknown email"}</p>
                    <StatusBadge status={referral.status} />
                  </div>
                  {referral.rejection_reason ? <p className="text-xs leading-5 text-danger">{referral.rejection_reason}</p> : null}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Deposits" value={referral.qualified_deposit_amount_usdt ? formatUsdt(referral.qualified_deposit_amount_usdt) : `Waiting for ${formatUsdt(REFERRAL_QUALIFY_DEPOSIT_USDT)}`} />
                    <Info label="Created" value={formatIstDate(referral.created_at)} />
                    <Info label="Reward" value={formatInr(referral.reward_amount_inr)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="p-4">Referred user email</th>
                    <th>Status</th>
                    <th>Qualified deposits</th>
                    <th>Created</th>
                    <th>Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedReferrals.map((referral) => (
                    <tr key={referral.id} className="border-t border-line align-top">
                      <td className="p-4">
                        <p className="font-medium text-zinc-800">{referral.referred?.email ?? "Unknown email"}</p>
                        {referral.rejection_reason ? <p className="mt-1 max-w-sm text-xs leading-5 text-danger">{referral.rejection_reason}</p> : null}
                      </td>
                      <td><StatusBadge status={referral.status} /></td>
                      <td>{referral.qualified_deposit_amount_usdt ? formatUsdt(referral.qualified_deposit_amount_usdt) : `Waiting for ${formatUsdt(REFERRAL_QUALIFY_DEPOSIT_USDT)}`}</td>
                      <td>{formatIstDate(referral.created_at)}</td>
                      <td>{formatInr(referral.reward_amount_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-5">
            <EmptyState title="No referrals yet" description="Users who register through your referral link will appear here along with their reward status." />
          </div>
        )}
      </section>
    </>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium text-zinc-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
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
