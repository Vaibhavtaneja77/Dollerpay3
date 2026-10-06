export const ORDER_STATUSES = [
  "PENDING_DEPOSIT",
  "DEPOSIT_DETECTED",
  "DEPOSIT_CONFIRMED",
  "PROCESSING_PAYOUT",
  "PAYOUT_SENT",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; detail: string }> = {
  PENDING_DEPOSIT: {
    label: "Pending Review",
    detail: "The sell order was created and is waiting for admin review."
  },
  DEPOSIT_DETECTED: {
    label: "Deposit Detected",
    detail: "The order has been acknowledged and moved into the review queue."
  },
  DEPOSIT_CONFIRMED: {
    label: "Accepted",
    detail: "The deposit has been confirmed and the order is approved for payout."
  },
  PROCESSING_PAYOUT: {
    label: "Processing Payout",
    detail: "The admin is preparing the INR payout."
  },
  PAYOUT_SENT: {
    label: "Payout Sent",
    detail: "The INR payout has been sent and is awaiting final confirmation."
  },
  COMPLETED: {
    label: "Completed",
    detail: "The order is complete."
  },
  REJECTED: {
    label: "Rejected",
    detail: "The order was rejected by the admin."
  },
  CANCELLED: {
    label: "Cancelled",
    detail: "The order was cancelled."
  },
  EXPIRED: {
    label: "Expired",
    detail: "The order expired before it could be processed."
  }
};

export const ORDER_TIMELINE = [
  { status: "PENDING_DEPOSIT" as const, label: "Order created" },
  { status: "DEPOSIT_CONFIRMED" as const, label: "Accepted" },
  { status: "PROCESSING_PAYOUT" as const, label: "Payout processing" },
  { status: "PAYOUT_SENT" as const, label: "Payout sent" },
  { status: "COMPLETED" as const, label: "Completed" }
] as const;

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_DEPOSIT: ["DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED", "PROCESSING_PAYOUT", "CANCELLED"],
  DEPOSIT_DETECTED: ["DEPOSIT_CONFIRMED", "PROCESSING_PAYOUT", "CANCELLED"],
  DEPOSIT_CONFIRMED: ["PROCESSING_PAYOUT", "CANCELLED"],
  PROCESSING_PAYOUT: ["PAYOUT_SENT", "COMPLETED", "CANCELLED"],
  PAYOUT_SENT: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: []
};

export const ADMIN_DROPDOWN_STATUSES: OrderStatus[] = [
  "PENDING_DEPOSIT",
  "DEPOSIT_CONFIRMED",
  "PROCESSING_PAYOUT",
  "PAYOUT_SENT",
  "COMPLETED",
  "CANCELLED"
];

export function getOrderStatusLabel(status: string) {
  return ORDER_STATUS_META[status as OrderStatus]?.label ?? status.replaceAll("_", " ");
}

export function getOrderStatusDetail(status: string) {
  return ORDER_STATUS_META[status as OrderStatus]?.detail ?? "Order status updated.";
}

export function isValidOrderStatus(status: string): status is OrderStatus {
  return ORDER_STATUSES.includes(status as OrderStatus);
}

export function canTransitionOrderStatus(current: string, next: string) {
  if (!isValidOrderStatus(current) || !isValidOrderStatus(next)) return false;
  return ORDER_STATUS_TRANSITIONS[current].includes(next);
}

export function getAllowedNextStatuses(current: string) {
  if (!isValidOrderStatus(current)) return [] as OrderStatus[];
  return ORDER_STATUS_TRANSITIONS[current];
}
