import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const csrfToken = String(form.get("csrf_token") ?? "");
  const cookieToken = (await cookies()).get("dollerpay_csrf")?.value ?? "";
  if (!csrfToken || csrfToken !== cookieToken) redirect("/login");

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
