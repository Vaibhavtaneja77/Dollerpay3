"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRemainingDuration, getRemainingMs } from "@/lib/countdown";

export function CountdownBadge({
  expiresAt,
  label,
  className,
  expiredLabel
}: {
  expiresAt: string;
  label: string;
  className?: string;
  expiredLabel?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(getRemainingMs(expiresAt));
    const timer = window.setInterval(() => setRemaining(getRemainingMs(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const expired = remaining !== null && remaining <= 0;
  const labelText = remaining === null ? `${label}: --` : expired ? (expiredLabel ?? "Expired") : `${label}: ${formatRemainingDuration(remaining)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        expired ? "border-zinc-300 bg-zinc-100 text-zinc-600" : "border-warning/30 bg-yellow-50 text-warning",
        className
      )}
      suppressHydrationWarning
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden />
      {labelText}
    </span>
  );
}
