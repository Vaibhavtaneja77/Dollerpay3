import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_TIMELINE } from "@/lib/order-status";

export function OrderTimeline({ status }: { status: string }) {
  const currentStatus = status === "DEPOSIT_DETECTED" ? "DEPOSIT_CONFIRMED" : status;
  const index = Math.max(0, ORDER_TIMELINE.findIndex((step) => step.status === currentStatus));
  return (
    <ol className="grid gap-3">
      {ORDER_TIMELINE.map(({ status: key, label }, i) => {
        const done = i <= index && !["REJECTED", "CANCELLED", "EXPIRED"].includes(status);
        return (
          <li key={key} className="flex items-center gap-3 text-sm">
            {done ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Circle className="h-5 w-5 text-zinc-300" aria-hidden />}
            <span className={cn(done ? "font-medium text-ink" : "text-zinc-500")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
