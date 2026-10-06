import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";
import { rateLimitResponse } from "@/lib/security";
import { adminStatusSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = adminStatusSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_deposits");
    const limited = await rateLimitResponse(`admin-deposit-verify:${user.id}`, 30);
    if (limited) return limited;
    await syncPendingExpirations();
    const { error } = await supabase.rpc("verify_deposit_request", {
      p_deposit_id: id,
      p_admin_id: user.id,
      p_note: body.note ?? null
    });
    if (error) throw error;
    return ok({ verified: true });
  } catch (error) {
    return fail(error);
  }
}
