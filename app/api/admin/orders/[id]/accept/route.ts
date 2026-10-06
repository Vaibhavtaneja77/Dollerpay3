import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { rateLimitResponse } from "@/lib/security";
import { adminStatusSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = adminStatusSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_orders");
    const limited = await rateLimitResponse(`admin-order-accept:${user.id}`, 30);
    if (limited) return limited;
    await syncPendingExpirations();

    const { error } = await supabase.rpc("transition_order_status", {
      p_order_id: id,
      p_next_status: "DEPOSIT_CONFIRMED",
      p_admin_id: user.id,
      p_note: body.note ?? "Successfully Deposit"
    });
    if (error) throw error;

    return ok({ accepted: true });
  } catch (error) {
    return fail(error);
  }
}
