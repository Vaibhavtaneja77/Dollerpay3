"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";

export function AdminDepositActions({ depositId, disabled }: { depositId: string; disabled?: boolean }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState("");
  const [confirmState, setConfirmState] = useState<null | "verify" | "reject">(null);
  const router = useRouter();
  const toast = useToast();

  async function post(path: string, body: unknown, success: string) {
    setLoading(path);
    const res = await csrfFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setLoading("");
    if (!res.ok) {
      toast.show("Action failed", { description: data.error ?? "Please check the deposit status.", variant: "error" });
      return;
    }
    toast.show(success, { description: "The customer wallet and queue were refreshed." });
    router.refresh();
  }

  return (
    <div className="grid min-w-0 gap-3">
      <Button
        disabled={disabled}
        loading={loading.includes("verify")}
        onClick={() => setConfirmState("verify")}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Verify and top up
      </Button>
      <div className="grid gap-2">
        <Input label="Reject reason" hint="Required before rejecting the top-up request." value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button
          disabled={disabled}
          variant="danger"
          loading={loading.includes("reject")}
          onClick={() => setConfirmState("reject")}
        >
          <XCircle className="h-4 w-4" aria-hidden /> Reject top-up
        </Button>
      </div>
      <ConfirmationModal
        open={confirmState === "verify"}
        title="Verify top-up request"
        description="This will approve the submitted proof and credit the customer's internal wallet."
        confirmLabel="Verify and top up"
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          await post(`/api/admin/deposits/${depositId}/verify`, { note: "Deposit proof verified" }, "Wallet topped up");
          setConfirmState(null);
        }}
        loading={loading.includes("verify")}
      />
      <ConfirmationModal
        open={confirmState === "reject"}
        title="Reject top-up request"
        description="Reject this request only if the proof is invalid or the transfer cannot be verified."
        confirmLabel="Reject top-up"
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          await post(`/api/admin/deposits/${depositId}/reject`, { reason }, "Deposit rejected");
          setConfirmState(null);
        }}
        loading={loading.includes("reject")}
        confirmDisabled={reason.trim().length < 8}
        variant="danger"
      >
        <Input label="Rejection reason" hint="Minimum 8 characters." value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 8 ? "Reason must be at least 8 characters." : undefined} />
      </ConfirmationModal>
    </div>
  );
}
