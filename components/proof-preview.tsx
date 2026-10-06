"use client";

import { useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProofPreview({ url, label = "Preview proof" }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const isPdf = url.toLowerCase().includes(".pdf");

  return (
    <>
      <Button variant="secondary" className="h-10 px-3" type="button" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-zinc-950/70 p-3 sm:place-items-center sm:p-6">
          <div className="grid max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <div className="flex items-center gap-1">
                <a className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-ink" href={url} target="_blank" rel="noreferrer" aria-label="Open proof in new tab">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-ink" onClick={() => setOpen(false)} aria-label="Close proof preview">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-zinc-50 p-3">
              {isPdf ? (
                <iframe className="h-[72vh] w-full rounded-lg border border-line bg-white" src={url} title={label} />
              ) : (
                <img className="mx-auto max-h-[72vh] w-auto max-w-full rounded-lg border border-line bg-white object-contain" src={url} alt={label} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
