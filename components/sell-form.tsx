"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js-light";
import { ArrowLeftRight, ShieldCheck, Wallet } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PaymentSuccessOverlay } from "@/components/payment-success-overlay";
import { AmountDropdown } from "@/components/ui/amount-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/transaction-rules";
import { formatInr, formatUsdt, multiplyMoney } from "@/lib/utils";

const fixedInrAmounts = ["5000", "10000", "20000", "30000", "50000"];
type SuccessDetails = {
  orderId: string;
  amountInr: string;
  amountUsdt: string;
  method: string;
};

const DIGITAL_ERUPEE_METHOD_ID = "digital-erupee";

function makeClientIdempotencyKey() {
  const webCrypto = globalThis.crypto;

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  const bytes = webCrypto?.getRandomValues ? webCrypto.getRandomValues(new Uint8Array(16)) : new Uint8Array(16).map(() => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function SellForm({
  rate,
  balance,
  maxAmount
}: {
  rate: string;
  balance: string;
  maxAmount: string;
}) {
  const [amountInr, setAmountInr] = useState(fixedInrAmounts[0]);
  const [confirming, setConfirming] = useState(false);
  const [showQrConfirmation, setShowQrConfirmation] = useState(false);
  const [orderQr, setOrderQr] = useState<File | null>(null);
  const [orderQrPreview, setOrderQrPreview] = useState<string | null>(null);
  const [qrHolderName, setQrHolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<{ available?: string; required?: string } | null>(null);
  const [success, setSuccess] = useState<SuccessDetails | null>(null);
  const router = useRouter();
  const toast = useToast();

  const quote = useMemo(() => {
    if (!amountInr || Number(amountInr) <= 0 || Number(rate) <= 0) return { usdt: "0", gross: "0", net: "0" };
    const usdt = new Decimal(amountInr).div(rate).toDecimalPlaces(6).toFixed(6);
    return { usdt, gross: new Decimal(amountInr).toDecimalPlaces(2).toFixed(2), net: new Decimal(amountInr).toDecimalPlaces(2).toFixed(2) };
  }, [amountInr, rate]);

  const amountNumber = Number(amountInr);
  const amountIsDecimal = /^\d+(\.\d{1,2})?$/.test(amountInr);
  const decimalAmount = new Decimal(quote.usdt);
  const invalidReason = !amountInr
    ? "Select the INR payout amount."
      : !amountIsDecimal || amountNumber <= 0
      ? "Enter a valid INR amount."
      : decimalAmount.gt(maxAmount)
          ? `Maximum payout amount is ${formatInr(multiplyMoney(maxAmount, rate))}.`
          : decimalAmount.gt(balance)
            ? `Your available balance is ${formatInr(multiplyMoney(balance, rate))}.`
            : qrHolderName.trim().length < 2
                ? "Enter the Digital Erupee QR holder name."
                : !orderQr
                  ? "Upload your Digital Erupee QR for this order."
                  : null;

  useEffect(() => {
    return () => {
      if (orderQrPreview?.startsWith("blob:")) URL.revokeObjectURL(orderQrPreview);
    };
  }, [orderQrPreview]);

  function setQrFile(file: File | null) {
    if (file && file.size > MAX_UPLOAD_BYTES) {
      toast.show(`Digital Erupee QR image must be ${MAX_UPLOAD_MB} MB or smaller.`, { variant: "error" });
      return;
    }

    setOrderQr(file);
    setShowQrConfirmation(false);
    setOrderQrPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function createOrder() {
    setLoading(true);
    setSubmitError(null);

    try {
      const form = new FormData();
      form.set("amount_usdt", quote.usdt);
      form.set("payment_method_id", DIGITAL_ERUPEE_METHOD_ID);
      form.set("idempotency_key", makeClientIdempotencyKey());
      form.set("qr_holder_name", qrHolderName.trim());
      if (orderQr) form.set("order_qr", orderQr);
      const res = await csrfFetch("/api/orders", { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.code === "INSUFFICIENT_BALANCE") {
          setSubmitError({ available: data.available_balance, required: data.required_amount });
        }
        toast.show(data?.error ?? "Order could not be created.", { variant: "error" });
        return;
      }

      setConfirming(false);
      setSuccess({
        orderId: data?.ticket_id ?? data?.order_id ?? "Created",
        amountInr,
        amountUsdt: quote.usdt,
        method: "Digital Erupee"
      });
    } catch {
      toast.show("Order upload could not finish. Please check your connection and try again.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <section className="mx-auto max-w-2xl animate-fade-up rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Sell for INR</h1>
      <div className="mt-6 grid gap-5">
        <div className="rounded-lg border border-line bg-zinc-50 p-4">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-zinc-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-zinc-500">Available wallet balance</p>
                <p className="mt-1 text-lg font-semibold">{formatInr(multiplyMoney(balance, rate))}</p>
                <p className="mt-1 text-xs text-zinc-500">{formatUsdt(balance)} available</p>
              </div>
            </div>
            <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-zinc-100" href="/sell?mode=topup">
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Top Up
            </Link>
          </div>
          <p className="mt-3 text-sm text-zinc-600">Sell up to {formatInr(multiplyMoney(maxAmount, rate))} in one order.</p>
        </div>

        <AmountDropdown
          label="INR payout amount"
          value={amountInr}
          options={fixedInrAmounts}
          onChange={setAmountInr}
          hint={`This converts to approx. ${formatUsdt(quote.usdt)} at Rs ${rate} / USDT before the sell order is created.`}
          error={invalidReason?.includes("payout amount") || invalidReason === "Enter a valid INR amount." ? invalidReason : undefined}
        />
        <div className="grid gap-4 rounded-lg border border-line bg-zinc-50 p-4">
          <div>
            <p className="text-sm font-semibold">Payout method</p>
            <p className="mt-1 text-sm text-zinc-600">Digital Erupee</p>
          </div>
          <Input
            label="Digital Erupee holder name"
            value={qrHolderName}
            onChange={(event) => {
              setQrHolderName(event.target.value);
              setShowQrConfirmation(false);
            }}
            placeholder="Name shown on QR"
            error={qrHolderName.trim().length > 0 && qrHolderName.trim().length < 2 ? "Holder name must be at least 2 characters." : undefined}
          />
          <label className="grid gap-2 text-sm font-medium">
            <span>Digital Erupee QR for this order</span>
            <input
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setQrFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs leading-5 text-zinc-600">Upload the exact Digital Erupee QR for this sell order. The QR and holder name will be used for payout verification.</p>
          {orderQrPreview ? (
            <img className="mt-3 aspect-square w-full max-w-44 rounded-lg border border-line bg-white object-contain p-3" src={orderQrPreview} alt="Digital Erupee QR preview for this order" />
          ) : null}
        </div>

        <div className="rounded-lg bg-zinc-50 p-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3"><span>Rate</span><strong className="text-right">Rs {rate} / USDT</strong></div>
            <div className="flex justify-between gap-3"><span>USDT sold</span><strong className="text-right">{formatUsdt(quote.usdt)}</strong></div>
            <div className="flex justify-between gap-3 border-t border-line pt-2"><span>Final payout</span><strong className="text-right">{formatInr(quote.net)}</strong></div>
          </div>
        </div>

        {submitError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Insufficient balance</p>
            <p className="mt-2 text-amber-800">Available: {formatUsdt(submitError.available ?? "0")}.</p>
            <p className="text-amber-800">Required: {formatUsdt(submitError.required ?? quote.usdt)}.</p>
            <div className="mt-3 grid gap-2 sm:flex">
              <Link className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-zinc-800" href="/sell?mode=topup">
                Top Up INR value
              </Link>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-medium hover:bg-zinc-50" type="button" onClick={() => setSubmitError(null)}>
                Back to sell
              </button>
            </div>
          </div>
        ) : null}

        {confirming ? (
          <div className="animate-scale-in rounded-lg border border-line p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <h2 className="font-semibold">Confirm Sell Order</h2>
            </div>
            <div className="grid gap-2 text-sm text-zinc-600">
              <p>{formatUsdt(quote.usdt)} x Rs {rate} = {formatInr(quote.gross)}</p>
              <p>Final payout: {formatInr(quote.net)}.</p>
              <p>Payment method: Digital Erupee with fresh QR.</p>
              <p>Holder name: {qrHolderName.trim()}.</p>
            </div>
            {orderQrPreview ? (
              <div className="mt-4 rounded-lg border border-line bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-600">Digital Erupee QR preview</p>
                <img className="mt-3 aspect-square w-full max-w-40 rounded-lg border border-line bg-white object-contain p-3" src={orderQrPreview} alt="Digital Erupee QR preview for this order" />
              </div>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button className="w-full" variant="secondary" type="button" onClick={() => setConfirming(false)}>Edit order</Button>
              <Button className="w-full" loading={loading} onClick={() => {
                setShowQrConfirmation(true);
              }}>Confirm Sell Order</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {invalidReason && !invalidReason.includes("payout amount") && invalidReason !== "Enter a valid INR amount." ? <p className="text-sm font-medium text-zinc-600">{invalidReason}</p> : null}
            <Button
              disabled={Boolean(invalidReason)}
              onClick={() => {
                if (invalidReason) {
                  toast.show(invalidReason, { variant: "error" });
                  return;
                }
                setConfirming(true);
              }}
            >
              Review order
            </Button>
          </div>
        )}
      </div>
    </section>
    <ConfirmationModal
      open={showQrConfirmation}
      title="Confirm Digital Erupee payout"
      description="Your sell order will be queued with the QR you uploaded for this order. Please check the QR and payout amount before continuing."
      confirmLabel="Confirm Sell Order"
      cancelLabel="Back"
      onCancel={() => setShowQrConfirmation(false)}
      onConfirm={async () => {
        setShowQrConfirmation(false);
        await createOrder();
      }}
      loading={loading}
    >
      <div className="grid gap-3 rounded-lg border border-line bg-zinc-50 p-4 text-sm text-zinc-600">
        <p><strong className="font-semibold text-zinc-800">Amount:</strong> {formatInr(quote.net)}</p>
        <p><strong className="font-semibold text-zinc-800">Method:</strong> Digital Erupee</p>
        <p><strong className="font-semibold text-zinc-800">Holder:</strong> {qrHolderName.trim()}</p>
        {orderQrPreview ? (
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="text-sm font-medium text-zinc-600">QR preview</p>
            <img className="mt-3 aspect-square w-full max-w-40 rounded-lg border border-line bg-white object-contain p-3" src={orderQrPreview} alt="Digital Erupee QR preview for this order" />
          </div>
        ) : null}
      </div>
    </ConfirmationModal>
    <PaymentSuccessOverlay
      open={Boolean(success)}
      title="Sell order submitted"
      description="Your payout order is queued. You can track verification updates from My Orders."
      details={[
        { label: "Order", value: success?.orderId ?? "" },
        { label: "Amount", value: success ? formatInr(success.amountInr) : "" },
        { label: "USDT", value: success ? formatUsdt(success.amountUsdt) : "" },
        { label: "Method", value: success?.method ?? "" },
        { label: "Status", value: "Queued" }
      ]}
      onViewDetails={() => {
        router.push("/orders");
      }}
    />
    </>
  );
}
