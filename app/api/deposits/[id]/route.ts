import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const { data, error } = await supabase
      .from("deposit_requests_decrypted")
      .select("id,ticket_id,amount_usdt,status,verified_at,coupon_code,coupon_reward_usdt")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    return ok({ deposit: data });
  } catch (error) {
    return fail(error);
  }
}
