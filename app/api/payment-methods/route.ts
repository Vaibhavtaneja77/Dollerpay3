import { fail, ok } from "@/lib/api";
import { requireCustomer } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";
import { paymentMethodSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { supabase, user } = await requireCustomer();
    const { data, error } = await supabase.from("payment_methods").select("*").eq("user_id", user.id).neq("type", "qr").order("is_default", { ascending: false });
    if (error) throw error;
    return ok({ payment_methods: data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireCustomer();
    const limited = await rateLimitResponse(`payment-method:${user.id}`, 10);
    if (limited) return limited;
    const { count } = await supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("type", "qr");
    if ((count ?? 0) >= 5) return ok({ error: "You can add up to 5 payout methods." }, { status: 422 });
    const contentType = request.headers.get("content-type") ?? "";

    let body: unknown;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const type = String(form.get("type") ?? "").trim();

      if (type === "upi") {
        body = { type, upi_id: String(form.get("upi_id") ?? "").trim(), display_name: String(form.get("display_name") ?? "").trim() || null };
      } else {
        body = {
          type,
          account_holder_name: String(form.get("account_holder_name") ?? "").trim(),
          bank_name: String(form.get("bank_name") ?? "").trim(),
          account_number: String(form.get("account_number") ?? "").trim(),
          ifsc: String(form.get("ifsc") ?? "").trim().toUpperCase(),
          display_name: String(form.get("display_name") ?? "").trim() || null
        };
      }
    } else {
      body = await request.json();
    }

    const parsed = paymentMethodSchema.parse(body);
    const result = parsed.type === "upi"
      ? await supabase
          .from("payment_methods")
          .insert({ user_id: user.id, type: "upi", upi_id: parsed.upi_id, display_name: parsed.display_name, is_default: !count })
          .select("*")
          .single()
      : await supabase
          .from("payment_methods")
          .insert({ user_id: user.id, type: "bank", account_holder_name: parsed.account_holder_name, bank_name: parsed.bank_name, account_number: parsed.account_number, ifsc: parsed.ifsc, display_name: parsed.display_name, is_default: !count })
          .select("*")
          .single();

    const { data, error } = result;
    if (error) throw error;
    return ok({ payment_method: data }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
