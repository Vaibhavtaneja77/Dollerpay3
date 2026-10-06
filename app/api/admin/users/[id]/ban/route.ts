import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { banUserSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = banUserSchema.parse(await request.json());
    const { supabase, user } = await requireAdminPermission("can_manage_users");
    const limited = await rateLimitResponse(`admin-user-ban:${user.id}`, 20);
    if (limited) return limited;
    const { error } = await supabase.rpc("set_user_ban_status", {
      p_target_user_id: id,
      p_banned: true,
      p_admin_id: user.id,
      p_reason: body.reason
    });
    if (error) throw error;
    return ok({ banned: true });
  } catch (error) {
    return fail(error);
  }
}
