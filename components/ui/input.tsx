import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, className, id, ...props }, ref) => {
  const inputId = id ?? props.name;
  return (
    <label className="grid gap-2 text-sm font-medium text-ink" htmlFor={inputId}>
      <span>{label}</span>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          "h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none placeholder:text-zinc-400 hover:border-zinc-300 focus:border-ink",
          error && "border-danger",
          className
        )}
        {...props}
      />
      {!error && hint ? (
        <span id={`${inputId}-hint`} className="text-xs font-medium text-zinc-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
});
Input.displayName = "Input";
