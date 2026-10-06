"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";

export function AdminReferralActions({ referralId, status }: { referralId: string; status: string }) {
  const [modal, setModal] = useState<null | "pay" | "reject">(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<null | "pay" | "reject">(null);
  const router = useRouter();
  const toast = useToast();

  async function markPaid() {
    setLoading("pay");
    const res = await csrfFetch(`/api/admin/referrals/${referralId}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note })
    });
    const data = await res.json().catch(() => null);
    setLoading(null);
    if (!res.ok) return toast.show(data?.error ?? "Referral payout could not be updated.", { variant: "error" });
    toast.show("Referral marked as paid");
    setModal(null);
    setNote("");
    router.refresh();
  }

  async function rejectReferral() {
    setLoading("reject");
    const res = await csrfFetch(`/api/admin/referrals/${referralId}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const data = await res.json().catch(() => null);
    setLoading(null);
    if (!res.ok) return toast.show(data?.error ?? "Referral reward could not be rejected.", { variant: "error" });
    toast.show("Referral reward rejected");
    setModal(null);
    setReason("");
    router.refresh();
  }

  if (status !== "READY_FOR_PAYOUT") {
    return <span className="text-sm text-zinc-500">No action needed</span>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button className="h-10 px-3" onClick={() => setModal("pay")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Mark paid
        </Button>
        <Button className="h-10 px-3" variant="danger" onClick={() => setModal("reject")}>
          <XCircle className="h-4 w-4" aria-hidden />
          Reject
        </Button>
      </div>

      <ConfirmationModal
        open={modal === "pay"}
        title="Mark referral reward as paid"
        description="Use this after you have manually paid the referral reward to the user's default payout method."
        confirmLabel="Confirm payout"
        onCancel={() => setModal(null)}
        onConfirm={markPaid}
        loading={loading === "pay"}
      >
        <Input label="Admin note" hint="Optional note for internal payout tracking." value={note} onChange={(event) => setNote(event.target.value)} />
      </ConfirmationModal>

      <ConfirmationModal
        open={modal === "reject"}
        title="Reject referral reward"
        description="Reject this reward only if the referral should not be paid. A reason is required."
        confirmLabel="Reject reward"
        onCancel={() => setModal(null)}
        onConfirm={rejectReferral}
        loading={loading === "reject"}
        confirmDisabled={reason.trim().length < 8}
        variant="danger"
      >
        <Input label="Rejection reason" hint="Minimum 8 characters." value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 8 ? "Reason must be at least 8 characters." : undefined} />
      </ConfirmationModal>
    </>
  );
}
