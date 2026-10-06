"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, IndianRupee, Upload, XCircle } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/transaction-rules";

export function AdminOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [proof, setProof] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState("");
  const [modal, setModal] = useState<null | "accept" | "process" | "complete" | "reject">(null);
  const router = useRouter();
  const toast = useToast();

  const canAccept = ["PENDING_DEPOSIT", "DEPOSIT_DETECTED"].includes(status);
  const canMoveToPayout = ["DEPOSIT_CONFIRMED"].includes(status);
  const canComplete = ["PROCESSING_PAYOUT", "PAYOUT_SENT"].includes(status);
  const canReject = !["COMPLETED", "REJECTED", "CANCELLED"].includes(status);

  async function post(path: string, body: BodyInit | null, label: string, isForm = false) {
    setLoading(path);
    try {
      const res = await csrfFetch(path, {
        method: "POST",
        headers: isForm ? undefined : { "content-type": "application/json" },
        body
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.show("Action failed", { description: data?.error ?? "Please review the order state and try again.", variant: "error" });
        return false;
      }

      toast.show(label, { description: "Order updated successfully." });
      router.refresh();
      return true;
    } catch {
      toast.show("Action failed", { description: "The request could not finish. Please check your connection and try again.", variant: "error" });
      return false;
    } finally {
      setLoading("");
    }
  }

  async function acceptOrder() {
    await post(`/api/admin/orders/${orderId}/accept`, JSON.stringify({ note }), "Successfully Deposit");
  }

  async function moveToPayout() {
    await post(`/api/admin/orders/${orderId}/process`, JSON.stringify({ note }), "Moved to payout processing");
  }

  async function completeOrder() {
    if (!proof) {
      toast.show("Upload payout proof", { description: "Attach the payout receipt before completing the order.", variant: "error" });
      return;
    }

    const form = new FormData();
    form.set("proof", proof);
    form.set("note", note);
    await post(`/api/admin/orders/${orderId}/complete`, form, "Order completed", true);
  }

  function setPayoutProof(file: File | null) {
    if (file && file.size > MAX_UPLOAD_BYTES) {
      toast.show(`Payout proof must be ${MAX_UPLOAD_MB} MB or smaller.`, { variant: "error" });
      return;
    }
    setProof(file);
  }

  async function rejectOrder() {
    const success = await post(`/api/admin/orders/${orderId}/reject`, JSON.stringify({ reason }), "Order rejected");
    if (success) {
      setModal(null);
      setReason("");
    }
  }

  return (
    <>
      <div className="grid gap-4">
        <div className="rounded-lg border border-line bg-zinc-50 p-4">
          <p className="text-sm font-semibold">Step 1: Accept order</p>
          <p className="mt-1 text-sm text-zinc-600">Use this when the order review is complete and you want to approve it.</p>
          <Input className="mt-4" label="Admin note" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button className="mt-4 w-full" disabled={!canAccept} loading={loading === `/api/admin/orders/${orderId}/accept`} onClick={() => setModal("accept")}>
            Accept order
          </Button>
        </div>

        <div className="rounded-lg border border-line bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <IndianRupee className="mt-0.5 h-5 w-5" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Step 2: Start payout</p>
              <p className="mt-1 text-sm text-zinc-600">Move the successfully deposited order into payout processing.</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="secondary" disabled={!canMoveToPayout} loading={loading === `/api/admin/orders/${orderId}/process`} onClick={() => setModal("process")}>
            Start payout
          </Button>
        </div>

        <div className="rounded-lg border border-line bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <Upload className="mt-0.5 h-5 w-5" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Step 3: Complete order</p>
              <p className="mt-1 text-sm text-zinc-600">Upload payout proof after the INR transfer is done.</p>
            </div>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            <span>Payout proof</span>
            <input className="rounded-md border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setPayoutProof(event.target.files?.[0] ?? null)} />
          </label>
          <Button className="mt-4 w-full" disabled={!canComplete} loading={loading === `/api/admin/orders/${orderId}/complete`} onClick={() => setModal("complete")}>
            Complete order
          </Button>
        </div>

        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-danger" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-danger">Reject order</p>
              <p className="mt-1 text-sm text-red-700">Reject only if the order cannot be processed.</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="danger" disabled={!canReject} onClick={() => setModal("reject")}>
            Reject order
          </Button>
        </div>
      </div>

      <ConfirmationModal
        open={modal === "accept"}
        title="Accept payout order"
        description="This approves the order for payout and records your current admin note."
        confirmLabel="Accept order"
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          await acceptOrder();
          setModal(null);
        }}
        loading={loading === `/api/admin/orders/${orderId}/accept`}
      />
      <ConfirmationModal
        open={modal === "process"}
        title="Start payout processing"
        description="This moves the order into the payout queue so the INR transfer can begin."
        confirmLabel="Start payout"
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          await moveToPayout();
          setModal(null);
        }}
        loading={loading === `/api/admin/orders/${orderId}/process`}
      />
      <ConfirmationModal
        open={modal === "complete"}
        title="Complete payout order"
        description="Make sure the transfer is finished and the uploaded proof matches this order before completing it."
        confirmLabel="Complete order"
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          await completeOrder();
          setModal(null);
        }}
        loading={loading === `/api/admin/orders/${orderId}/complete`}
      />
      <ConfirmationModal
        open={modal === "reject"}
        title="Reject payout order"
        description="Reject this order only if it cannot be safely processed. A reason is required."
        confirmLabel="Reject order"
        onCancel={() => setModal(null)}
        onConfirm={rejectOrder}
        loading={loading === `/api/admin/orders/${orderId}/reject`}
        confirmDisabled={reason.trim().length < 8}
        variant="danger"
      >
        <Input className="mt-1" label="Reason" hint="Minimum 8 characters." value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 8 ? "Reason must be at least 8 characters." : undefined} />
      </ConfirmationModal>
    </>
  );
}
