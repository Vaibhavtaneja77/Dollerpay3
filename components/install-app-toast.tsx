"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let installToastShownThisLoad = false;

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean(navigator.standalone))
  );
}

function isIosLike() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallAppToast() {
  const toast = useToast();
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalled()) return;
    if (installToastShownThisLoad) return;

    function markShown() {
      installToastShownThisLoad = true;
    }

    if (isIosLike()) {
      const id = window.setTimeout(() => {
        if (isInstalled()) return;
        markShown();
        toast.show("Install DollerPay", {
          description: "On iPhone, open Share and choose Add to Home Screen.",
          variant: "info",
          durationMs: 12000
        });
      }, 1000);
      return () => window.clearTimeout(id);
    }

    function showInstallToast(event: Event) {
      if (installToastShownThisLoad) return;
      promptRef.current = event as BeforeInstallPromptEvent;
      markShown();

      toast.show("Install DollerPay", {
        description: "Add this app to your home screen for faster access.",
        variant: "info",
        durationMs: 12000,
        action: {
          label: "Install",
          onClick: () => {
            const promptEvent = promptRef.current;
            if (!promptEvent || isInstalled()) return;
            promptRef.current = null;
            void promptEvent.prompt().catch(() => {
              toast.show("Install DollerPay", {
                description: "Use your browser menu or address bar install option to add the app.",
                variant: "info",
                durationMs: 8000
              });
            });
          }
        }
      });
    }

    function clearPrompt() {
      promptRef.current = null;
    }

    window.addEventListener("beforeinstallprompt", showInstallToast);
    window.addEventListener("appinstalled", clearPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", showInstallToast);
      window.removeEventListener("appinstalled", clearPrompt);
    };
  }, [toast]);

  return null;
}
