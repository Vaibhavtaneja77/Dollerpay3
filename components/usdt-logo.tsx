import { cn } from "@/lib/utils";

export function UsdtLogo({ className }: { className?: string }) {
  return (
    <img className={cn("inline-block rounded-full shadow-sm", className)} src="/icons/icon.svg" alt="" aria-hidden />
  );
}
