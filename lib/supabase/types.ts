export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; email: string; referral_code: string; role: "customer" | "admin"; status: "active" | "banned"; onboarding_completed: boolean; created_at: string };
        Insert: { id: string; full_name?: string | null; email: string; referral_code?: string; role?: "customer" | "admin"; status?: "active" | "banned"; onboarding_completed?: boolean };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      wallets: {
        Row: { id: string; user_id: string; address: string; available_balance: string; locked_balance: string; status: string; created_at: string };
        Insert: { user_id: string; address: string; available_balance?: string; locked_balance?: string; status?: string };
        Update: Partial<Database["public"]["Tables"]["wallets"]["Insert"]>;
      };
      payment_methods: {
        Row: { id: string; user_id: string; type: "upi" | "bank" | "qr"; display_name: string | null; upi_id: string | null; qr_path: string | null; account_holder_name: string | null; bank_name: string | null; account_number: string | null; ifsc: string | null; is_default: boolean; status: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]> & { user_id: string; type: "upi" | "bank" | "qr" };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Insert"]>;
      };
      orders: {
        Row: { id: string; ticket_id: string; idempotency_key: string; user_id: string; wallet_id: string; amount_usdt: string; rate: string; gross_inr: string; fees: string; net_inr: string; payment_method_id: string | null; payment_method_snapshot: Json; status: string; queue_position: number; created_at: string; updated_at: string; admin_id: string | null; admin_notes: string | null; payment_proof_path: string | null; rejection_reason: string | null; completed_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & { ticket_id: string; user_id: string; wallet_id: string; amount_usdt: string; rate: string; gross_inr: string; fees: string; net_inr: string; payment_method_id?: string | null; payment_method_snapshot: Json; status: string };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_status_history: {
        Row: { id: string; order_id: string; status: string; actor_id: string | null; note: string | null; created_at: string };
        Insert: { order_id: string; status: string; actor_id?: string | null; note?: string | null };
        Update: Partial<Database["public"]["Tables"]["order_status_history"]["Insert"]>;
      };
      transactions: {
        Row: { id: string; order_id: string | null; tx_hash: string | null; network: string | null; amount: string | null; status: string; created_at: string };
        Insert: { order_id?: string | null; tx_hash?: string | null; network?: string | null; amount?: string | null; status?: string };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      payment_proofs: {
        Row: { id: string; order_id: string; uploaded_by: string; storage_path: string; created_at: string };
        Insert: { order_id: string; uploaded_by: string; storage_path: string };
        Update: Partial<Database["public"]["Tables"]["payment_proofs"]["Insert"]>;
      };
      admin_notes: {
        Row: { id: string; order_id: string | null; admin_id: string; note: string; created_at: string };
        Insert: { order_id?: string | null; admin_id: string; note: string };
        Update: Partial<Database["public"]["Tables"]["admin_notes"]["Insert"]>;
      };
      platform_settings: {
        Row: { id: number; usdt_inr_rate: string; platform_fee_percent: string; min_sell_amount: string; min_deposit_amount: string; max_sell_amount: string; admin_wallet_address: string; admin_wallet_qr_path: string | null; supported_network: string; processing_message: string; maintenance_mode: boolean; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["platform_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Insert"]>;
      };
      audit_logs: {
        Row: { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string; metadata: Json; created_at: string };
        Insert: { actor_id?: string | null; action: string; entity_type: string; entity_id: string; metadata?: Json };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
      admin_email_allowlist: {
        Row: { email: string; created_at: string; created_by: string | null };
        Insert: { email: string; created_by?: string | null };
        Update: { email?: string; created_by?: string | null };
      };
      admin_permissions: {
        Row: { email: string; can_manage_orders: boolean; can_manage_deposits: boolean; can_manage_referrals: boolean; can_manage_users: boolean; can_manage_wallets: boolean; can_manage_settings: boolean; can_manage_admins: boolean; updated_at: string; updated_by: string | null };
        Insert: { email: string; can_manage_orders?: boolean; can_manage_deposits?: boolean; can_manage_referrals?: boolean; can_manage_users?: boolean; can_manage_wallets?: boolean; can_manage_settings?: boolean; can_manage_admins?: boolean; updated_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["admin_permissions"]["Insert"]>;
      };
      coupons: {
        Row: { code: string; reward_usdt: string; max_redemptions: number; redeemed_count: number; active: boolean; expires_at: string | null; created_at: string; created_by: string | null };
        Insert: { code: string; reward_usdt: string; max_redemptions: number; redeemed_count?: number; active?: boolean; expires_at?: string | null; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
      };
      coupon_redemptions: {
        Row: { id: string; coupon_code: string; user_id: string; deposit_request_id: string; reward_usdt: string; status: "PENDING" | "CONFIRMED" | "REJECTED"; created_at: string; confirmed_at: string | null; rejected_at: string | null };
        Insert: { coupon_code: string; user_id: string; deposit_request_id: string; reward_usdt: string; status?: "PENDING" | "CONFIRMED" | "REJECTED"; confirmed_at?: string | null; rejected_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["coupon_redemptions"]["Insert"]>;
      };
      deposit_requests: {
        Row: { id: string; ticket_id: string; user_id: string; wallet_id: string; amount_usdt: string; network: string; admin_wallet_address: string; proof_path: string | null; status: "PENDING_DEPOSIT" | "DEPOSIT_CONFIRMED" | "REJECTED" | "EXPIRED"; admin_id: string | null; admin_notes: string | null; rejection_reason: string | null; created_at: string; verified_at: string | null; coupon_code: string | null; coupon_reward_usdt: string };
        Insert: { ticket_id: string; user_id: string; wallet_id: string; amount_usdt: string; network: string; admin_wallet_address: string; proof_path?: string | null; status?: "PENDING_DEPOSIT" | "DEPOSIT_CONFIRMED" | "REJECTED" | "EXPIRED"; admin_id?: string | null; admin_notes?: string | null; rejection_reason?: string | null; coupon_code?: string | null; coupon_reward_usdt?: string };
        Update: Partial<Database["public"]["Tables"]["deposit_requests"]["Insert"]>;
      };
      referrals: {
        Row: { id: string; referrer_id: string; referred_user_id: string; status: "REGISTERED" | "READY_FOR_PAYOUT" | "PAID" | "REJECTED" | "LIMIT_REACHED"; reward_amount_inr: string; qualified_deposit_amount_usdt: string | null; qualified_at: string | null; paid_at: string | null; admin_id: string | null; admin_note: string | null; rejection_reason: string | null; created_at: string; updated_at: string };
        Insert: { referrer_id: string; referred_user_id: string; status?: "REGISTERED" | "READY_FOR_PAYOUT" | "PAID" | "REJECTED" | "LIMIT_REACHED"; reward_amount_inr?: string; qualified_deposit_amount_usdt?: string | null; qualified_at?: string | null; paid_at?: string | null; admin_id?: string | null; admin_note?: string | null; rejection_reason?: string | null };
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
      };
    };
    Views: {
      platform_settings_decrypted: {
        Row: Database["public"]["Tables"]["platform_settings"]["Row"];
      };
      deposit_requests_decrypted: {
        Row: Database["public"]["Tables"]["deposit_requests"]["Row"];
      };
      transactions_decrypted: {
        Row: Database["public"]["Tables"]["transactions"]["Row"];
      };
    };
    Functions: {
      create_sell_order: {
        Args: { p_ticket_id: string; p_amount_usdt: string; p_payment_method_id: string | null; p_idempotency_key: string };
        Returns: string;
      };
      create_deposit_request: {
        Args: { p_ticket_id: string; p_user_id: string; p_wallet_id: string; p_amount_usdt: string; p_network: string; p_admin_wallet_address: string; p_proof_path: string | null; p_coupon_code: string | null };
        Returns: string;
      };
      transition_order_status: {
        Args: { p_order_id: string; p_next_status: string; p_admin_id: string; p_note: string | null };
        Returns: undefined;
      };
      complete_sell_order: {
        Args: { p_order_id: string; p_admin_id: string; p_payment_proof_path: string; p_note: string | null };
        Returns: undefined;
      };
      reject_sell_order: {
        Args: { p_order_id: string; p_admin_id: string; p_reason: string };
        Returns: undefined;
      };
      set_user_ban_status: {
        Args: { p_target_user_id: string; p_banned: boolean; p_admin_id: string; p_reason: string | null };
        Returns: undefined;
      };
      is_admin_email: {
        Args: { p_email: string };
        Returns: boolean;
      };
      sync_admin_profiles_from_allowlist: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      verify_deposit_request: {
        Args: { p_deposit_id: string; p_admin_id: string; p_note: string | null };
        Returns: undefined;
      };
      reject_deposit_request: {
        Args: { p_deposit_id: string; p_admin_id: string; p_reason: string };
        Returns: undefined;
      };
      expire_pending_sell_orders: {
        Args: { p_user_id: string | null };
        Returns: number;
      };
      expire_pending_deposit_requests: {
        Args: { p_user_id: string | null };
        Returns: number;
      };
      register_referral: {
        Args: { p_referral_code: string; p_referred_user_id: string };
        Returns: string;
      };
      refresh_referrals_for_referrer: {
        Args: { p_referrer_id: string };
        Returns: number;
      };
      refresh_referrals_for_referred_user: {
        Args: { p_referred_user_id: string };
        Returns: number;
      };
      mark_referral_paid: {
        Args: { p_referral_id: string; p_admin_id: string; p_note: string | null };
        Returns: undefined;
      };
      reject_referral_reward: {
        Args: { p_referral_id: string; p_admin_id: string; p_reason: string };
        Returns: undefined;
      };
    };
  };
};
