import { z } from "zod";

const decimalString = z.coerce.string().regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount");
const optionalCouponCode = z.preprocess(
  (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text ? text.toUpperCase() : null;
  },
  z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/, "Use only letters, numbers, hyphens, or underscores").nullable()
);

export const profileSchema = z.object({
  email: z.string().trim().email(),
  referral_code: z.string().trim().min(4).max(20).optional()
});

export const authEmailSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

export const registerSchema = authEmailSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  referral_code: z.string().trim().min(4).max(20).optional().nullable()
});

export const walletSchema = z.object({});

export const upiMethodSchema = z.object({
  type: z.literal("upi"),
  upi_id: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID"),
  display_name: z.string().trim().max(80).optional().nullable()
});

export const bankMethodSchema = z.object({
  type: z.literal("bank"),
  account_holder_name: z.string().trim().min(2).max(120),
  bank_name: z.string().trim().min(2).max(120),
  account_number: z.string().trim().regex(/^\d{9,18}$/, "Enter a valid account number"),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC"),
  display_name: z.string().trim().max(80).optional().nullable()
});

export const paymentMethodSchema = z.discriminatedUnion("type", [upiMethodSchema, bankMethodSchema]);

export const orderCreateSchema = z.object({
  amount_usdt: decimalString.refine((value) => Number(value) > 0, "Enter a valid USDT amount"),
  payment_method_id: z.union([z.string().uuid(), z.literal("digital-erupee")]),
  idempotency_key: z.string().uuid(),
  qr_holder_name: z.string().trim().min(2).max(120).optional()
});

export const depositCreateSchema = z.object({
  amount_usdt: decimalString.refine((value) => Number(value) > 0, "Enter a valid USDT amount"),
  coupon_code: optionalCouponCode
});

export const depositRejectSchema = z.object({
  reason: z.string().trim().min(8, "A rejection reason is required").max(500)
});

export const adminStatusSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  tx_hash: z.string().trim().max(128).optional()
});

export const adminCompleteSchema = z.object({
  proof_path: z.string().trim().min(3).max(500).regex(/^(payouts|deposits|payment-methods)\/[A-Za-z0-9_-]+\/[0-9a-fA-F-]+\.(png|jpg|jpeg|webp|pdf)$/, "Invalid proof path"),
  note: z.string().trim().max(1000).optional()
});

export const adminRejectSchema = z.object({
  reason: z.string().trim().min(8, "A rejection reason is required").max(500)
});

export const banUserSchema = z.object({
  reason: z.string().trim().min(8, "A ban reason is required").max(500)
});

export const referralPayoutSchema = z.object({
  note: z.string().trim().max(1000).optional()
});

export const walletAdjustmentSchema = z.object({
  direction: z.enum(["credit", "debit"]),
  amount_usdt: decimalString.refine((value) => Number(value) > 0, "Enter a valid adjustment amount"),
  reason: z.string().trim().min(8, "An adjustment reason is required").max(500)
});

export const settingsSchema = z.object({
  usdt_inr_rate: decimalString,
  platform_fee_percent: z.coerce.string().regex(/^\d+(\.\d{1,4})?$/),
  min_sell_amount: decimalString,
  min_deposit_amount: decimalString,
  max_sell_amount: decimalString,
  admin_wallet_address: z.string().trim().min(8).max(180),
  admin_wallet_qr_path: z.string().trim().max(500).optional().nullable(),
  supported_network: z.string().trim().min(2).max(40),
  processing_message: z.string().trim().min(5).max(240),
  maintenance_mode: z.boolean()
});

export const adminPermissionsSchema = z.object({
  can_manage_orders: z.boolean().default(false),
  can_manage_deposits: z.boolean().default(false),
  can_manage_referrals: z.boolean().default(false),
  can_manage_users: z.boolean().default(false),
  can_manage_wallets: z.boolean().default(false),
  can_manage_settings: z.boolean().default(false),
  can_manage_admins: z.boolean().default(false)
});

export const adminCreateSchema = z.object({
  email: z.string().trim().email().toLowerCase()
}).merge(adminPermissionsSchema);

export const adminUpdateSchema = adminPermissionsSchema;

export const couponCreateSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, hyphens, or underscores").transform((value) => value.toUpperCase()),
  reward_usdt: decimalString.refine((value) => Number(value) > 0, "Enter a valid reward"),
  max_redemptions: z.coerce.number().int().min(1).max(1_000_000),
  active: z.boolean().default(true),
  expires_at: z.string().trim().datetime().optional().nullable()
});

export const couponDeleteSchema = z.object({
  code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase())
});

export const clientEventSchema = z.object({
  event_type: z.enum(["USER_SIDE_ERROR", "USER_SIDE_NOT_FOUND"]),
  path: z.string().trim().min(1).max(240),
  message: z.string().trim().max(500).optional().nullable(),
  digest: z.string().trim().max(160).optional().nullable()
});
