import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("can_manage_orders");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q");
    const page = Number(url.searchParams.get("page") ?? 1);
    const from = Math.max(0, (page - 1) * 25);
    let query = supabase.from("orders").select("*, profiles(email, full_name)", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + 24);
    if (status && status !== "all") query = query.eq("status", status);
    if (q) query = query.ilike("ticket_id", `%${q.replace(/[%_]/g, "")}%`);
    const { data, count, error } = await query;
    if (error) throw error;
    return ok({ orders: data, count });
  } catch (error) {
    return fail(error);
  }
}
