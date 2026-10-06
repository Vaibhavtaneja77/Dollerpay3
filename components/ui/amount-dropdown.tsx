"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn, formatInr } from "@/lib/utils";

type AmountDropdownProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
};

export function AmountDropdown({ label, value, options, onChange, hint, error }: AmountDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = formatInr(value);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <button
        type="button"
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left shadow-sm transition hover:bg-zinc-50",
          open ? "border-zinc-400 ring-4 ring-zinc-100" : "border-line",
          error ? "border-danger ring-red-50" : ""
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-base font-semibold text-ink">{selectedLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-500 transition", open ? "rotate-180" : "")} aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[4.75rem] z-30 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-soft" role="listbox">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  "flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-semibold transition",
                  selected ? "bg-ink text-white" : "text-zinc-700 hover:bg-zinc-50"
                )}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{formatInr(option)}</span>
                {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {hint ? <span className="text-xs font-normal text-zinc-500">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </div>
  );
}
