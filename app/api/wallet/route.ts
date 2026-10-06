import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";

function walletAddress(userId: string) {
  return `INT-USDT-${userId.slice(0, 8).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET() {
  try {
    const { supabase, user } = await requireCustomer();
    const { data, error } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
    if (error && error.code !== "PGRST116") throw error;
    return ok({ wallet: data ?? null });
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    const { supabase, user } = await requireCustomer();
    const limited = await rateLimitResponse(`wallet-create:${user.id}`, 5);
    if (limited) return limited;
    const { data: existing } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
    if (existing) return ok({ wallet: existing });

    const { data, error } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, address: walletAddress(user.id), available_balance: "0", locked_balance: "0", status: "active" })
      .select("*")
      .single();
    if (error) throw error;
    return ok({ wallet: data }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
