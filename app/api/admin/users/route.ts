import { fail, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminPermission("can_manage_users");
    const q = new URL(request.url).searchParams.get("q");
    let query = supabase.from("profiles").select("*, wallets(address, available_balance), orders(id, amount_usdt, net_inr)").order("created_at", { ascending: false }).limit(50);
    if (q) query = query.ilike("email", `%${q.replace(/[%_]/g, "")}%`);
    const { data, error } = await query;
    if (error) throw error;
    return ok({ users: data });
  } catch (error) {
    return fail(error);
  }
}
