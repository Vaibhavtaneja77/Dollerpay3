"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";

export function AdminWalletAdjustment({ walletId }: { walletId?: string | null }) {
  const [open, setOpen] = useState<null | "credit" | "debit">(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function adjust() {
    if (!walletId || !open) return;
    setLoading(true);
    const res = await csrfFetch(`/api/admin/wallets/${walletId}/adjust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: open, amount_usdt: amount, reason })
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      toast.show("Adjustment failed", { description: data?.error ?? "Review the wallet balance and reason.", variant: "error" });
      return;
    }
    toast.show("Wallet adjusted");
    setOpen(null);
    setAmount("");
    setReason("");
    router.refresh();
  }

  if (!walletId) return <span className="text-sm text-zinc-500">No wallet</span>;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-10 px-3" variant="secondary" onClick={() => setOpen("credit")}>
          <Plus className="h-4 w-4" aria-hidden />
          Credit
        </Button>
        <Button className="h-10 px-3" variant="danger" onClick={() => setOpen("debit")}>
          <Minus className="h-4 w-4" aria-hidden />
          Debit
        </Button>
      </div>
      <ConfirmationModal
        open={Boolean(open)}
        title={open === "credit" ? "Credit wallet" : "Debit wallet"}
        description="Manual wallet adjustments affect the customer's available USDT balance and are recorded in audit logs."
        confirmLabel={open === "credit" ? "Credit wallet" : "Debit wallet"}
        onCancel={() => setOpen(null)}
        onConfirm={adjust}
        loading={loading}
        confirmDisabled={!amount || Number(amount) <= 0 || reason.trim().length < 8}
        variant={open === "debit" ? "danger" : "primary"}
      >
        <div className="grid gap-4">
          <Input label="Amount USDT" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input label="Reason" hint="Minimum 8 characters." value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 8 ? "Reason must be at least 8 characters." : undefined} />
        </div>
      </ConfirmationModal>
    </>
  );
}
