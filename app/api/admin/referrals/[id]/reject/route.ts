import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { adminRejectSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = adminRejectSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_referrals");
    const limited = await rateLimitResponse(`admin-referral-reject:${user.id}`, 20);
    if (limited) return limited;
    const { error } = await supabase.rpc("reject_referral_reward", {
      p_referral_id: id,
      p_admin_id: user.id,
      p_reason: body.reason
    });
    if (error) throw error;
    return ok({ rejected: true });
  } catch (error) {
    return fail(error);
  }
}
