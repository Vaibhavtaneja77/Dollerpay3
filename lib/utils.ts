import { clsx, type ClassValue } from "clsx";
import Decimal from "decimal.js-light";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInr(value: string | number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatUsdt(value: string | number) {
  return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(value))} USDT`;
}

export function formatIstDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

export function formatIstDate(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

export function multiplyMoney(amount: string, rate: string) {
  return new Decimal(amount).mul(new Decimal(rate)).toDecimalPlaces(2).toFixed(2);
}

export function maskAccount(account?: string | null) {
  if (!account) return "Not available";
  const last = account.replace(/\s/g, "").slice(-4);
  return `XXXX XXXX ${last}`;
}

export function makeTicketId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `USDT-${date}-${suffix}`;
}

export function humanizeError(message?: string) {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("valid_bank")) return "Add valid bank details: holder name, bank name, 9-18 digit account number, and IFSC.";
  if (message.includes("valid_upi")) return "Enter a valid UPI ID.";
  if (message.includes("invalid referral code")) return "That referral link is not valid anymore.";
  if (message.includes("self referral")) return "You cannot use your own referral link.";
  if (message.includes("referral is not ready for payout")) return "This referral is not ready for payout yet.";
  if (message.includes("invalid regular expression")) return "Payment validation needs the latest database migration. Apply the regex fix migration and try again.";
  if (message.includes("duplicate") || message.includes("unique")) return "This item already exists.";
  if (message.includes("permission") || message.includes("policy")) return "You are not allowed to perform this action.";
  if (message.includes("invalid state transition")) return "That status change is not allowed from the order's current state.";
  if (message.includes("rejection reason")) return "A rejection reason is required before the order can be rejected.";
  if (message.includes("balance")) return "Your available USDT balance is not enough for this order.";
  return "We could not complete the request. Please review the details and try again.";
}
