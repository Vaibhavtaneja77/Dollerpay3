import { Send } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const TELEGRAM_SUPPORT_URL = "https://t.me/Dollerpay1122";

type TelegramSupportLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  label?: string;
};

export function TelegramSupportLink({ className, label = "Telegram support", ...props }: TelegramSupportLinkProps) {
  return (
    <a
      href={TELEGRAM_SUPPORT_URL}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center justify-center gap-2 font-medium transition", className)}
      {...props}
    >
      <Send className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}
