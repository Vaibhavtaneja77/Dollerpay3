import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { InstallAppToast } from "@/components/install-app-toast";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "DollerPay",
  description: "USDT to INR payout operations platform",
  manifest: "/manifest.webmanifest",
  applicationName: "DollerPay",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DollerPay"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#050505"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <ToastProvider>
          <InstallAppToast />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
