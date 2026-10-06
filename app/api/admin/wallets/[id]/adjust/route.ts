import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { walletAdjustmentSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = walletAdjustmentSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_wallets");
    const limited = await rateLimitResponse(`admin-wallet-adjust:${user.id}`, 10);
    if (limited) return limited;

    const { error } = await supabase.rpc("adjust_wallet_available_balance", {
      p_wallet_id: id,
      p_admin_id: user.id,
      p_direction: body.direction,
      p_amount_usdt: body.amount_usdt,
      p_reason: body.reason
    });
    if (error) throw error;

    return ok({ adjusted: true });
  } catch (error) {
    return fail(error);
  }
}
