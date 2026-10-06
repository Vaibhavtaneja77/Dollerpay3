import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({ className, variant = "primary", loading, disabled, children, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-ink text-white hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-zinc-200",
    secondary: "border border-line bg-white text-ink hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-4 focus-visible:ring-zinc-100",
    ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-ink focus-visible:ring-4 focus-visible:ring-zinc-100",
    danger: "bg-danger text-white hover:bg-red-700 focus-visible:ring-4 focus-visible:ring-red-100"
  };

  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
