"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PREF_KEY = "dollerpay.notifications.enabled";
const LEGACY_PREF_KEY = "txchange.notifications.enabled";
const PREF_EVENT = "dollerpay-notification-preference";

function getPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function getEnabledPreference() {
  if (typeof window === "undefined") return true;
  return (window.localStorage.getItem(PREF_KEY) ?? window.localStorage.getItem(LEGACY_PREF_KEY)) !== "false";
}

export function NotificationPreferences() {
  const toast = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setPermission(getPermission());
    setEnabled(getEnabledPreference());
  }, []);

  async function enable() {
    if (getPermission() === "unsupported") return;
    const nextPermission = getPermission() === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      window.localStorage.setItem(PREF_KEY, "true");
      setEnabled(true);
      window.dispatchEvent(new Event(PREF_EVENT));
      toast.show("Notifications enabled", { description: "Important order and top-up updates can now alert you." });
    }
  }

  function disable() {
    window.localStorage.setItem(PREF_KEY, "false");
    setEnabled(false);
    window.dispatchEvent(new Event(PREF_EVENT));
    toast.show("Notifications disabled");
  }

  async function testNotification() {
    if (getPermission() !== "granted") {
      toast.show("Enable notifications first", { variant: "error" });
      return;
    }
    new Notification("DollerPay notifications are working", {
      body: "You will receive important order and top-up updates here.",
      icon: "/icons/icon.svg"
    });
  }

  const status = permission === "unsupported"
    ? "This browser does not support notifications."
    : permission === "denied"
      ? "Notifications are blocked in browser settings."
      : permission === "granted" && enabled
        ? "Notifications are enabled."
        : permission === "granted"
          ? "Notifications are paused."
          : "Notifications are on by default, but your browser still needs permission.";

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-zinc-100 p-2 text-zinc-700">
          {permission === "granted" && enabled ? <Bell className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Notifications</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{status}</p>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <Button className="h-10" type="button" onClick={enable} disabled={permission === "unsupported" || permission === "denied"}>
              <Bell className="h-4 w-4" aria-hidden />
              Enable
            </Button>
            <Button className="h-10" type="button" variant="secondary" onClick={disable} disabled={permission !== "granted" || !enabled}>
              <BellOff className="h-4 w-4" aria-hidden />
              Pause
            </Button>
            <Button className="h-10" type="button" variant="ghost" onClick={testNotification} disabled={permission !== "granted" || !enabled}>
              <Send className="h-4 w-4" aria-hidden />
              Test
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
