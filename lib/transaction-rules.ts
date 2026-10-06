import Decimal from "decimal.js-light";

export const MIN_TRANSACTION_USDT = "25";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_MB = 50;
export const PENDING_DEPOSIT_WINDOW_MS = 45 * 60 * 1000;
export const PENDING_WITHDRAWAL_WINDOW_MS = 3 * 60 * 60 * 1000;
export const PAYMENT_ASSET_BUCKET = "payment-proofs";
export const ACTIVE_DEPOSIT_STATUSES = ["PENDING_DEPOSIT"];

export function getEffectiveWithdrawalMin(minSellAmount: string) {
  const configured = new Decimal(minSellAmount);
  const minimum = new Decimal(MIN_TRANSACTION_USDT);
  return configured.greaterThan(minimum) ? configured.toFixed(2) : minimum.toFixed(2);
}

export function isBelowMinimumTransaction(amount: string | number) {
  return new Decimal(amount).lt(MIN_TRANSACTION_USDT);
}
