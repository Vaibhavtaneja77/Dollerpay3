"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";

export function UserActions({ userId, status }: { userId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const toast = useToast();
  async function toggle() {
    const path = status === "banned" ? "unban" : "ban";
    setLoading(true);
    const res = await csrfFetch(`/api/admin/users/${userId}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    setLoading(false);
    if (!res.ok) return toast.show("User action failed");
    toast.show(status === "banned" ? "User unbanned" : "User banned");
    setOpen(false);
    setReason("");
    router.refresh();
  }
  return (
    <>
      <Button className="w-full sm:w-auto" variant={status === "banned" ? "secondary" : "danger"} loading={loading} onClick={() => setOpen(true)}>
        {status === "banned" ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <ShieldBan className="h-4 w-4" aria-hidden />}
        {status === "banned" ? "Unban" : "Ban"}
      </Button>
      <ConfirmationModal
        open={open}
        title={status === "banned" ? "Restore user access" : "Ban this user"}
        description={status === "banned" ? "This user will regain access to the platform immediately." : "Banned users cannot place orders or access protected customer flows."}
        confirmLabel={status === "banned" ? "Unban user" : "Ban user"}
        onCancel={() => setOpen(false)}
        onConfirm={toggle}
        loading={loading}
        confirmDisabled={status !== "banned" && reason.trim().length < 8}
        variant={status === "banned" ? "primary" : "danger"}
      >
        {status !== "banned" ? <Input label="Ban reason" hint="Minimum 8 characters." value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 8 ? "Reason must be at least 8 characters." : undefined} /> : null}
      </ConfirmationModal>
    </>
  );
}
