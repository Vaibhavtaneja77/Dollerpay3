"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrdersRefreshButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      className="h-10 px-3"
      loading={isPending}
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Refresh orders"
    >
      {!isPending ? <RotateCw className="h-4 w-4" aria-hidden /> : null}
      {label}
    </Button>
  );
}
