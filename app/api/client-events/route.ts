import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEventSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const limited = await rateLimitResponse(`client-event:${user.id}`, 12, 60_000);
    if (limited) return limited;

    const body = clientEventSchema.parse(await request.json());
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: body.event_type,
      entity_type: "app_route",
      entity_id: body.path,
      metadata: {
        path: body.path,
        message: body.message ?? null,
        digest: body.digest ?? null,
        user_email: user.email ?? null,
        user_agent: request.headers.get("user-agent")?.slice(0, 240) ?? null
      }
    });
    if (error) throw error;

    return ok({ logged: true });
  } catch (error) {
    return fail(error);
  }
}
