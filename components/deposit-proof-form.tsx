"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountdownBadge } from "@/components/countdown-badge";
import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { PaymentSuccessOverlay } from "@/components/payment-success-overlay";
import { getExpiresAt } from "@/lib/countdown";
import { PENDING_DEPOSIT_WINDOW_MS } from "@/lib/transaction-rules";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { formatUsdt } from "@/lib/utils";

type SuccessDetails = {
  ticketId: string;
  amountUsdt: string;
  couponCode?: string | null;
  couponRewardUsdt?: string | null;
};

type PaymentDetails = SuccessDetails & {
  depositId: string;
  createdAt: string;
  walletAddress: string;
  network: string;
  qrUrl: string | null;
};

export function DepositProofForm({
  adminWalletAddress,
  network,
  rate,
  minDepositAmount
}: {
  adminWalletAddress: string;
  network: string;
  rate: string;
  minDepositAmount: string;
}) {
  const [loading, setLoading] = useState(false);
  const [amountUsdt, setAmountUsdt] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const amountError = useMemo(() => {
    if (!/^\d+(\.\d{1,6})?$/.test(amountUsdt) || Number(amountUsdt) <= 0) return "Enter a valid USDT amount.";
    if (Number(amountUsdt) < Number(minDepositAmount)) return `Amount must be at least ${formatUsdt(minDepositAmount)}.`;
    return undefined;
  }, [amountUsdt, minDepositAmount]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d+(\.\d{1,6})?$/.test(amountUsdt) || Number(amountUsdt) <= 0) {
      toast.show("Enter the USDT amount.");
      return;
    }

    if (Number(amountUsdt) < Number(minDepositAmount)) {
      toast.show(`Minimum deposit amount is ${formatUsdt(minDepositAmount)}.`);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("amount_usdt", amountUsdt);
      formData.set("coupon_code", couponCode.trim());
      const res = await csrfFetch("/api/deposits", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.show(data?.error ?? "Order could not be created.");
        return;
      }

      setPayment({
        depositId: data?.deposit?.id ?? "",
        ticketId: data?.deposit?.ticket_id ?? "Pending review",
        amountUsdt,
        couponCode: data?.deposit?.coupon_code,
        couponRewardUsdt: data?.deposit?.coupon_reward_usdt,
        createdAt: data?.deposit?.created_at ?? new Date().toISOString(),
        walletAddress: data?.payment?.walletAddress ?? adminWalletAddress,
        network: data?.payment?.network ?? network,
        qrUrl: data?.payment?.qrUrl ?? null
      });
      setVerified(false);
    } catch {
      toast.show("Order could not be created. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!payment?.depositId || verified) return;

    const depositId = payment.depositId;
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await csrfFetch(`/api/deposits/${depositId}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.deposit?.status === "DEPOSIT_CONFIRMED") {
          setPayment((current) => current
            ? {
                ...current,
                couponCode: data.deposit.coupon_code ?? current.couponCode,
                couponRewardUsdt: data.deposit.coupon_reward_usdt ?? current.couponRewardUsdt
              }
            : current);
          setVerified(true);
          router.refresh();
        }
      } catch {
        // Polling will retry on the next interval.
      }
    }

    void checkStatus();
    const interval = window.setInterval(checkStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [payment?.depositId, router, verified]);

  if (loading) {
    return (
      <section className="mx-auto grid max-w-2xl animate-fade-up place-items-center gap-4 rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        <Loader2 className="h-10 w-10 animate-spin text-ink" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Creating order</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Please wait while we reserve your payment window.</p>
        </div>
      </section>
    );
  }

  if (payment) {
    return (
      <>
      <section className="mx-auto max-w-2xl animate-fade-up rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Order created</h1>
            <p className="mt-2 break-all font-mono text-sm text-zinc-600">{payment.ticketId}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 rounded-lg border border-line bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Send {formatUsdt(payment.amountUsdt)}</p>
              <p className="mt-1 text-sm text-zinc-600">{payment.network}</p>
            </div>
            <CountdownBadge
              expiresAt={getExpiresAt(payment.createdAt, PENDING_DEPOSIT_WINDOW_MS)}
              label="Time left"
              expiredLabel="Verifying, taking a little bit longer. Kindly wait patiently."
            />
          </div>

          {payment.qrUrl ? (
            <img className="mx-auto aspect-square w-full max-w-64 rounded-lg border border-line bg-white object-contain p-3" src={payment.qrUrl} alt="Admin payment wallet QR code" />
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">QR code is not configured yet. Use the wallet address below.</div>
          )}

          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs font-medium uppercase text-zinc-500">Wallet address</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="break-all font-mono text-sm text-zinc-700">{payment.walletAddress}</p>
              <CopyButton value={payment.walletAddress} label="Copy payment wallet"><Copy className="h-4 w-4" /></CopyButton>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm leading-6">
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 font-medium text-red-800">
            Send only {payment.network} crypto to this wallet. Sending another crypto or using a wrong network can lead to permanent loss.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-medium text-amber-900">
            After payment, wait up to 15 minutes for the order to complete. It will be automatically verified on blockchain.
          </p>
          {payment.couponCode ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-900">
              Coupon {payment.couponCode} applied. Reward after verification: {formatUsdt(payment.couponRewardUsdt ?? "0")}.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => router.push(`/orders/deposits/${payment.depositId}`)}>View details</Button>
          <Link className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-zinc-800" href="/orders">Go to orders</Link>
        </div>
      </section>
      <PaymentSuccessOverlay
        open={verified}
        title="Top-up completed"
        description="Your USDT top-up has been verified and credited to your wallet."
        details={[
          { label: "Ticket", value: payment.ticketId },
          { label: "Amount", value: formatUsdt(payment.amountUsdt) },
          ...(payment.couponCode ? [{ label: "Coupon", value: `${payment.couponCode} (+${formatUsdt(payment.couponRewardUsdt ?? "0")})` }] : []),
          { label: "Status", value: "Successfully Deposit" }
        ]}
        onViewDetails={() => router.push(`/orders/deposits/${payment.depositId}`)}
      />
      </>
    );
  }

  return (
    <section className="mx-auto max-w-2xl animate-fade-up rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <div className="flex items-start gap-2">
        <Wallet className="h-5 w-5" aria-hidden />
        <h1 className="text-xl font-semibold sm:text-2xl">Top up with USDT</h1>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Enter your USDT amount and optional coupon code first. We’ll create your order and show the payment QR on the next step.
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-600">Minimum deposit amount: {formatUsdt(minDepositAmount)}.</p>

      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <Input
          label="USDT amount"
          inputMode="decimal"
          placeholder={minDepositAmount}
          value={amountUsdt}
          onChange={(event) => setAmountUsdt(event.target.value)}
          hint={`This amount will be credited after verification. Current display rate is Rs ${rate} / USDT.`}
          error={amountError}
        />
        <Input
          label="Coupon code"
          name="coupon_code_display"
          value={couponCode}
          onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
          placeholder="Optional"
          autoCapitalize="characters"
          hint="Coupon rewards are added after the top-up is verified."
        />
        {amountError ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-warning">
            <AlertCircle className="h-4 w-4" aria-hidden />
            Amount must meet the minimum before submission.
          </p>
        ) : null}
        <Button loading={loading} disabled={Boolean(amountError)}>Create order</Button>
      </form>
    </section>
  );
}
