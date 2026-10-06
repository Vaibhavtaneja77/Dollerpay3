"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { csrfFetch } from "@/lib/csrf";

type ClientEventReporterProps = {
  eventType: "USER_SIDE_ERROR" | "USER_SIDE_NOT_FOUND";
  message?: string;
  digest?: string;
};

export function ClientEventReporter({ eventType, message, digest }: ClientEventReporterProps) {
  const pathname = usePathname();

  useEffect(() => {
    const key = `dollerpay.client-event.${eventType}.${pathname}.${digest ?? message ?? ""}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");

    void csrfFetch("/api/client-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        path: pathname,
        message: message?.slice(0, 500) ?? null,
        digest: digest ?? null
      })
    }).catch(() => {
      window.sessionStorage.removeItem(key);
    });
  }, [digest, eventType, message, pathname]);

  return null;
}
