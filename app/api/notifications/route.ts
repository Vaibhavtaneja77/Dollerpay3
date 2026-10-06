import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile?.status !== "active") return ok({ updates: [] });

    const isAdmin = profile.role === "admin";
    await syncPendingExpirations(isAdmin ? undefined : user.id);

    let ordersQuery = supabase
        .from("orders")
      .select("id,ticket_id,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    let depositsQuery = supabase
        .from("deposit_requests")
      .select("id,ticket_id,status,created_at,verified_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isAdmin) {
      ordersQuery = ordersQuery.eq("user_id", user.id);
      depositsQuery = depositsQuery.eq("user_id", user.id);
    }

    const auditQuery = isAdmin
      ? supabase
          .from("audit_logs")
          .select("id,action,entity_id,metadata,created_at")
          .in("action", ["USER_SIDE_ERROR", "USER_SIDE_NOT_FOUND"])
          .order("created_at", { ascending: false })
          .limit(25)
      : null;

    const [{ data: orders, error: ordersError }, { data: deposits, error: depositsError }, { data: auditLogs, error: auditError }] = await Promise.all([
      ordersQuery,
      depositsQuery,
      auditQuery ?? Promise.resolve({ data: [], error: null })
    ]);

    if (ordersError) throw ordersError;
    if (depositsError) throw depositsError;
    if (auditError) throw auditError;

    return ok({
      updates: [
        ...(orders ?? []).map((order) => ({
          id: order.id,
          kind: "order" as const,
          audience: isAdmin ? "admin" as const : "customer" as const,
          ticketId: order.ticket_id,
          status: order.status,
          updatedAt: order.updated_at,
          notifyOnNew: isAdmin && order.status === "PENDING_DEPOSIT"
        })),
        ...(deposits ?? []).map((deposit) => ({
          id: deposit.id,
          kind: "deposit" as const,
          audience: isAdmin ? "admin" as const : "customer" as const,
          ticketId: deposit.ticket_id,
          status: deposit.status,
          updatedAt: deposit.verified_at ?? deposit.created_at,
          notifyOnNew: isAdmin && deposit.status === "PENDING_DEPOSIT"
        })),
        ...(auditLogs ?? []).map((log) => ({
          id: log.id,
          kind: "audit" as const,
          audience: "admin" as const,
          ticketId: log.action === "USER_SIDE_NOT_FOUND" ? "User reached missing page" : "User-side page error",
          status: log.action,
          updatedAt: log.created_at,
          notifyOnNew: true,
          message: typeof log.metadata === "object" && log.metadata && "path" in log.metadata ? String(log.metadata.path) : log.entity_id
        }))
      ]
    });
  } catch (error) {
    return fail(error);
  }
}
