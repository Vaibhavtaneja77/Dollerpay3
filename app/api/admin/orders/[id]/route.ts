import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { canTransitionOrderStatus, isValidOrderStatus } from "@/lib/order-status";
import { rateLimitResponse } from "@/lib/security";
import { adminStatusSchema } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdminPermission("can_manage_orders");
    const { data, error } = await supabase.from("orders").select("*, profiles(email, full_name, status)").eq("id", id).single();
    if (error) throw error;
    return ok({ order: data });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status, note } = await request.json() as { status?: string; note?: string };
    const { supabase, user } = await requireAdminPermission("can_manage_orders");
    const limited = await rateLimitResponse(`admin-order-status:${user.id}`, 30);
    if (limited) return limited;

    if (!status || !isValidOrderStatus(status) || status === "REJECTED" || status === "CANCELLED") {
      throw new Error("invalid state transition");
    }

    const { data: order, error: orderError } = await supabase.from("orders").select("status").eq("id", id).single();
    if (orderError) throw orderError;

    if (status === order.status) return ok({ updated: true, status });
    if (!canTransitionOrderStatus(order.status, status)) throw new Error("invalid state transition");

    const parsed = adminStatusSchema.parse({ note });
    const { error } = await supabase.rpc("transition_order_status", {
      p_order_id: id,
      p_next_status: status,
      p_admin_id: user.id,
      p_note: parsed.note ?? null
    });
    if (error) throw error;
    return ok({ updated: true, status });
  } catch (error) {
    return fail(error);
  }
}
