"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  variant?: "primary" | "danger";
  children?: React.ReactNode;
};

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  loading,
  confirmDisabled,
  error,
  variant = "primary",
  children
}: ConfirmationModalProps) {
  if (!open) return null;

  const tone = variant === "danger"
    ? {
        icon: <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />,
        panel: "border-red-100 bg-red-50/60"
      }
    : {
        icon: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />,
        panel: "border-emerald-100 bg-emerald-50/60"
      };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-lg animate-scale-in rounded-lg border border-line bg-white shadow-soft">
        <div className={cn("rounded-t-lg border-b p-4 sm:p-5", tone.panel)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-white p-2 shadow-sm">{tone.icon}</div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{description}</p>
              </div>
            </div>
            <button className="rounded-full p-2 text-zinc-500 hover:bg-white hover:text-ink" onClick={onCancel} aria-label="Close modal">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">
          {children}
          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" type="button" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button className="w-full sm:w-auto" variant={variant === "danger" ? "danger" : "primary"} type="button" onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
