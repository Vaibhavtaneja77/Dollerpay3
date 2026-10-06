import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireAdminPermission("can_manage_users");
    const limited = await rateLimitResponse(`admin-user-unban:${user.id}`, 20);
    if (limited) return limited;
    const { error } = await supabase.rpc("set_user_ban_status", {
      p_target_user_id: id,
      p_banned: false,
      p_admin_id: user.id,
      p_reason: null
    });
    if (error) throw error;
    return ok({ banned: false });
  } catch (error) {
    return fail(error);
  }
}
