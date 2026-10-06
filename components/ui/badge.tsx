import { cn } from "@/lib/utils";
import { getOrderStatusLabel } from "@/lib/order-status";
import { AlertCircle, CheckCircle2, Clock3, RotateCw, XCircle } from "lucide-react";

const statusMap: Record<string, string> = {
  PENDING_DEPOSIT: "border-warning/30 bg-yellow-50 text-warning",
  DEPOSIT_DETECTED: "border-sky-200 bg-sky-50 text-sky-700",
  DEPOSIT_CONFIRMED: "border-sky-200 bg-sky-50 text-sky-700",
  PROCESSING_PAYOUT: "border-sky-200 bg-sky-50 text-sky-700",
  PAYOUT_SENT: "border-success/30 bg-green-50 text-success",
  COMPLETED: "border-success/30 bg-green-50 text-success",
  READY_FOR_PAYOUT: "border-sky-200 bg-sky-50 text-sky-700",
  PAID: "border-success/30 bg-green-50 text-success",
  REGISTERED: "border-warning/30 bg-yellow-50 text-warning",
  LIMIT_REACHED: "border-zinc-300 bg-zinc-100 text-zinc-600",
  REJECTED: "border-danger/30 bg-red-50 text-danger",
  CANCELLED: "border-zinc-300 bg-zinc-100 text-zinc-600",
  EXPIRED: "border-zinc-300 bg-zinc-100 text-zinc-600"
};

export function StatusBadge({ status, className, label }: { status: string; className?: string; label?: string }) {
  const Icon = getStatusIcon(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusMap[status] ?? "border-line bg-zinc-50 text-zinc-700", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? getOrderStatusLabel(status)}
    </span>
  );
}

function getStatusIcon(status: string) {
  if (status === "COMPLETED" || status === "PAYOUT_SENT" || status === "PAID") return CheckCircle2;
  if (status === "REJECTED") return XCircle;
  if (status === "EXPIRED" || status === "CANCELLED" || status === "LIMIT_REACHED") return AlertCircle;
  if (status === "PROCESSING_PAYOUT" || status === "DEPOSIT_DETECTED" || status === "DEPOSIT_CONFIRMED" || status === "READY_FOR_PAYOUT") return RotateCw;
  return Clock3;
}
