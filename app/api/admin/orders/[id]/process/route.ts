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
    const limited = await rateLimitResponse(`admin-order-process:${user.id}`, 30);
    if (limited) return limited;
    await syncPendingExpirations();
    const { error } = await supabase.rpc("transition_order_status", {
      p_order_id: id,
      p_next_status: "PROCESSING_PAYOUT",
      p_admin_id: user.id,
      p_note: body.note ?? null
    });
    if (error) throw error;
    return ok({ processed: true });
  } catch (error) {
    return fail(error);
  }
}
