import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { rateLimitResponse } from "@/lib/security";
import { adminRejectSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = adminRejectSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_orders");
    await syncPendingExpirations();
    const limited = await rateLimitResponse(`admin-reject:${user.id}`, 20);
    if (limited) return limited;
    const { error } = await supabase.rpc("reject_sell_order", {
      p_order_id: id,
      p_admin_id: user.id,
      p_reason: body.reason
    });
    if (error) throw error;
    return ok({ rejected: true });
  } catch (error) {
    return fail(error);
  }
}
