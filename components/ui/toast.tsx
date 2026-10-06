"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";
type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
};
type ToastContextValue = {
  show: (message: string, options?: { description?: string; variant?: ToastVariant; action?: { label: string; onClick: () => void }; durationMs?: number }) => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);

function makeToastId() {
  const webCrypto = globalThis.crypto;

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  const randomPart =
    webCrypto?.getRandomValues
      ? Array.from(webCrypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(16).padStart(8, "0")).join("")
      : Math.random().toString(36).slice(2);

  return `toast-${Date.now().toString(36)}-${randomPart}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const value = useMemo(
    () => ({
      show: (title: string, options?: { description?: string; variant?: ToastVariant; action?: { label: string; onClick: () => void }; durationMs?: number }) => {
        const id = makeToastId();
        setToasts((current) => [...current.slice(-2), { id, title, description: options?.description, variant: options?.variant ?? "success", action: options?.action }]);
        window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), options?.durationMs ?? 5200);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 grid w-[min(420px,calc(100vw-24px))] gap-3 sm:bottom-5 sm:right-5 sm:w-[min(420px,calc(100vw-32px))]">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="animate-slide-in rounded-2xl border border-line bg-white p-4 text-sm text-ink shadow-soft">
            <div className="flex items-start gap-3">
              <ToastIcon variant={toast.variant} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 leading-5 text-zinc-600">{toast.description}</p> : null}
                {toast.action ? (
                  <button
                    className="mt-3 inline-flex h-9 items-center rounded-lg bg-ink px-3 text-sm font-medium text-white hover:bg-zinc-800"
                    onClick={() => {
                      toast.action?.onClick();
                      setToasts((current) => current.filter((item) => item.id !== toast.id));
                    }}
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-ink" aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "error") return <AlertCircle className="mt-0.5 h-5 w-5 text-danger" aria-hidden />;
  if (variant === "info") return <Info className="mt-0.5 h-5 w-5 text-zinc-500" aria-hidden />;
  return <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
