import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireCustomer();
    const limited = await rateLimitResponse(`payment-method-update:${user.id}`, 20);
    if (limited) return limited;
    const contentType = _.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) return ok({ error: "Digital Erupee QR is uploaded per sell order now." }, { status: 422 });

    const { data: method, error: methodError } = await supabase
      .from("payment_methods")
      .select("id,user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (methodError) throw methodError;

    const { error: clearError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id);
    if (clearError) throw clearError;

    const { data, error } = await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", method.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    return ok({ payment_method: data });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireCustomer();
    const limited = await rateLimitResponse(`payment-method-delete:${user.id}`, 20);
    if (limited) return limited;
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_method_id", id)
      .eq("user_id", user.id)
      .in("status", ["PENDING_DEPOSIT", "DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED", "PROCESSING_PAYOUT"]);
    if (count) return ok({ error: "Payment method is attached to a pending order." }, { status: 409 });

    const { error } = await supabase.from("payment_methods").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;

    const { data: remaining } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if ((remaining ?? []).length && !remaining?.some((method) => method.is_default)) {
      const nextDefault = remaining?.[0];
      if (nextDefault) {
        await supabase.from("payment_methods").update({ is_default: true }).eq("id", nextDefault.id).eq("user_id", user.id);
      }
    }

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
