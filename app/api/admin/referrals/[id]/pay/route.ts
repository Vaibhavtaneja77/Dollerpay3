import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { referralPayoutSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = referralPayoutSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_referrals");
    const limited = await rateLimitResponse(`admin-referral-pay:${user.id}`, 20);
    if (limited) return limited;
    const { error } = await supabase.rpc("mark_referral_paid", {
      p_referral_id: id,
      p_admin_id: user.id,
      p_note: body.note ?? null
    });
    if (error) throw error;
    return ok({ paid: true });
  } catch (error) {
    return fail(error);
  }
}
