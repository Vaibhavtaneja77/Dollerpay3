import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { rateLimitResponse } from "@/lib/security";
import { depositRejectSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = depositRejectSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_deposits");
    const limited = await rateLimitResponse(`admin-deposit-reject:${user.id}`, 30);
    if (limited) return limited;
    await syncPendingExpirations();
    const { error } = await supabase.rpc("reject_deposit_request", {
      p_deposit_id: id,
      p_admin_id: user.id,
      p_reason: body.reason
    });
    if (error) throw error;
    return ok({ rejected: true });
  } catch (error) {
    return fail(error);
  }
}
