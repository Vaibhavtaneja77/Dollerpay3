import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { syncPendingExpirations } from "@/lib/expirations";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireCustomer();
    await syncPendingExpirations(user.id);
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).single();
    if (error) throw error;
    return ok({ order: data });
  } catch (error) {
    return fail(error);
  }
}
