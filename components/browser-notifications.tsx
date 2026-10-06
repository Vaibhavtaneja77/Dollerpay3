"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationUpdate = {
  id: string;
  kind: "order" | "deposit" | "audit";
  audience?: "customer" | "admin";
  ticketId: string;
  status: string;
  updatedAt: string;
  notifyOnNew?: boolean;
  message?: string;
};

const IMPORTANT_STATUSES = new Set([
  "PENDING_DEPOSIT",
  "DEPOSIT_CONFIRMED",
  "PROCESSING_PAYOUT",
  "PAYOUT_SENT",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "USER_SIDE_ERROR",
  "USER_SIDE_NOT_FOUND"
]);

const STORAGE_KEY = "dollerpay.notification-statuses";
const LEGACY_STORAGE_KEY = "tetherpayout.notification-statuses";
const PREF_KEY = "dollerpay.notifications.enabled";
const LEGACY_PREF_KEY = "txchange.notifications.enabled";
const PREF_EVENT = "dollerpay-notification-preference";

let promptShownThisLoad = false;

function getPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function readPreviousStatuses() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return value ? (JSON.parse(value) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStatuses(updates: NotificationUpdate[]) {
  const next = Object.fromEntries(updates.map((update) => [`${update.audience ?? "customer"}:${update.kind}:${update.id}`, update.status]));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function titleFor(update: NotificationUpdate) {
  if (update.kind === "audit") {
    if (update.status === "USER_SIDE_NOT_FOUND") return "User opened missing page";
    return "User-side page error";
  }

  if (update.kind === "deposit") {
    if (update.status === "PENDING_DEPOSIT") return update.audience === "admin" ? "New top-up request" : "USDT top-up submitted";
    if (update.status === "DEPOSIT_CONFIRMED") return "USDT top-up confirmed";
    if (update.status === "REJECTED") return "USDT top-up rejected";
    if (update.status === "EXPIRED") return "USDT top-up expired";
    return "USDT top-up updated";
  }

  if (update.status === "PENDING_DEPOSIT") return update.audience === "admin" ? "New sell order" : "Sell order submitted";
  if (update.status === "DEPOSIT_CONFIRMED") return "Sell order accepted";
  if (update.status === "PROCESSING_PAYOUT") return "Payout is processing";
  if (update.status === "PAYOUT_SENT") return "Payout sent";
  if (update.status === "COMPLETED") return "Order completed";
  if (update.status === "REJECTED") return "Order rejected";
  if (update.status === "CANCELLED") return "Order cancelled";
  if (update.status === "EXPIRED") return "Order expired";
  return "Order updated";
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

async function showBrowserNotification(update: NotificationUpdate) {
  const statusText = update.status.replaceAll("_", " ").toLowerCase();
  const options: NotificationOptions = {
    body: update.kind === "audit"
      ? update.message ?? "Open audit logs for details."
      : update.notifyOnNew
      ? `${update.ticketId} needs verification.`
      : `${update.ticketId} status changed to ${statusText}.`,
    tag: `dollerpay-${update.audience ?? "customer"}-${update.kind}-${update.id}-${update.status}`,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    data: {
      url: update.kind === "audit"
        ? "/admin/audit"
        : update.audience === "admin"
          ? (update.kind === "order" ? `/admin/orders/${update.id}` : "/admin/transactions")
          : update.kind === "order"
            ? `/orders/${update.id}`
            : "/orders"
    }
  };

  try {
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    if (registration?.showNotification) {
      await registration.showNotification(titleFor(update), options);
      return;
    }

    new Notification(titleFor(update), options);
  } catch {
    // Browser notifications are best effort; blocked or unavailable platforms should not break the app.
  }
}

export function BrowserNotifications() {
  const [mounted, setMounted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [preferenceEnabled, setPreferenceEnabled] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const supported = permission !== "unsupported";
  const enabled = permission === "granted" && preferenceEnabled;

  const syncUpdates = useCallback(() => {
    void (async () => {
      if (getPermission() !== "granted") return;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      const res = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal }).finally(() => {
        window.clearTimeout(timeout);
      });
      if (!res.ok) return;

      const data = (await res.json()) as { updates?: NotificationUpdate[] };
      const updates = data.updates ?? [];
      const previous = readPreviousStatuses();

      for (const update of updates) {
        const key = `${update.audience ?? "customer"}:${update.kind}:${update.id}`;
        if (((!previous[key] && update.notifyOnNew) || (previous[key] && previous[key] !== update.status)) && IMPORTANT_STATUSES.has(update.status)) {
          await showBrowserNotification(update);
        }
      }

      writeStatuses(updates);
    })().catch(() => {
      // Network can disappear between polls. The next interval will try again.
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    setPermission(getPermission());
    const savedPreference = window.localStorage.getItem(PREF_KEY) ?? window.localStorage.getItem(LEGACY_PREF_KEY);
    setPreferenceEnabled(savedPreference !== "false");
    if (!promptShownThisLoad && getPermission() === "default" && savedPreference !== "false") {
      promptShownThisLoad = true;
      setShowPrompt(true);
    }
    registerServiceWorker();

    const onPreferenceChange = () => setPreferenceEnabled((window.localStorage.getItem(PREF_KEY) ?? window.localStorage.getItem(LEGACY_PREF_KEY)) !== "false");
    window.addEventListener(PREF_EVENT, onPreferenceChange);
    window.addEventListener("storage", onPreferenceChange);
    return () => {
      window.removeEventListener(PREF_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onPreferenceChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    syncUpdates();
    const interval = window.setInterval(syncUpdates, 15000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncUpdates();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, syncUpdates]);

  const requestNotifications = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowPrompt(false);
    if (result === "granted") {
      window.localStorage.setItem(PREF_KEY, "true");
      setPreferenceEnabled(true);
      await registerServiceWorker();
      syncUpdates();
    }
  };

  if (!mounted || !supported || permission === "granted") return null;

  if (showPrompt && permission === "default") {
    return (
      <div className="fixed left-3 right-3 top-20 z-[70] rounded-2xl border border-line bg-white p-3 shadow-soft sm:left-auto sm:right-4 sm:w-80">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <Bell className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Enable important alerts</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">Get order, top-up, and verification updates even after reload.</p>
            <div className="mt-3 flex gap-2">
              <Button className="h-9 px-3 text-xs" onClick={requestNotifications}>Allow</Button>
              <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setShowPrompt(false)}>Later</Button>
            </div>
          </div>
          <button className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-ink" onClick={() => setShowPrompt(false)} aria-label="Dismiss notification prompt">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      className="h-10 w-10 rounded-xl px-0"
      aria-label={permission === "denied" ? "Browser notifications blocked" : "Enable browser notifications"}
      disabled={permission === "denied"}
      onClick={requestNotifications}
    >
      {permission === "denied" ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
    </Button>
  );
}
