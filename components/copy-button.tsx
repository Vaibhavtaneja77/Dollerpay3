"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyButton({ value, label, children }: { value: string; label: string; children: React.ReactNode }) {
  const toast = useToast();
  return (
    <Button variant="ghost" className="h-9 px-2 text-current hover:bg-white/10" aria-label={label} onClick={() => navigator.clipboard.writeText(value).then(() => toast.show("Copied"))}>
      {children}
    </Button>
  );
}
