"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detail = {
  label: string;
  value: string;
};

export function PaymentSuccessOverlay({
  open,
  title,
  description,
  details,
  onViewDetails
}: {
  open: boolean;
  title: string;
  description: string;
  details: Detail[];
  onViewDetails: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowDetails(false);
      return;
    }

    const id = window.setTimeout(() => setShowDetails(true), 1200);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-white/92 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-line bg-white p-5 text-center shadow-soft">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-zinc-50">
          <div className="payment-success-ring grid h-20 w-20 place-items-center rounded-full">
            <div className="payment-success-check grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm">
              <Check className="h-8 w-8 text-success" aria-hidden />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-success">{showDetails ? "Submitted" : "Processing"}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{showDetails ? title : "Confirming request"}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{showDetails ? description : "Please wait while we save your request."}</p>
        </div>

        {showDetails ? (
          <div className="mt-5 grid gap-2 rounded-xl border border-line bg-zinc-50 p-3 text-left">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-zinc-500">
                  {detail.label === "Status" ? <Clock3 className="h-3.5 w-3.5" aria-hidden /> : <ReceiptText className="h-3.5 w-3.5" aria-hidden />}
                  {detail.label}
                </span>
                <strong className="max-w-[55%] break-words text-right font-semibold text-ink">{detail.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {showDetails ? (
          <Button className="mt-5 w-full" type="button" onClick={onViewDetails}>
            View details
          </Button>
        ) : null}
      </div>
    </div>
  );
}
