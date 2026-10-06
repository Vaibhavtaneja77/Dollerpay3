"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csrfFetch } from "@/lib/csrf";
import { createClient } from "@/lib/supabase/browser";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters")
});

type FormValues = z.infer<typeof schema>;

export function AuthForm({ mode, referralCode }: { mode: "login" | "register"; referralCode?: string | null }) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function submit(values: FormValues) {
    setLoading(true);
    setServerError("");
    const referralSuffix = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "";
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword(values)
      : await csrfFetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, referral_code: referralCode ?? undefined })
        });
    setLoading(false);

    if (mode === "register") {
      const data = await (result as Response).json();
      if (!(result as Response).ok) {
        setServerError(data.error ?? "Account could not be created. Please try again.");
        return;
      }
      router.replace(data.redirectTo ?? `/dashboard${referralSuffix}`);
      router.refresh();
      return;
    }

    if ("error" in result && result.error) {
      const message = result.error.message.toLowerCase().includes("rate limit")
        ? "Too many attempts right now. Please wait a few minutes and try again."
        : result.error.message;
      setServerError(message);
      return;
    }

    if (!("data" in result)) {
      setServerError("Login failed. Please try again.");
      return;
    }

    const signedInUser = result.data.user;
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("status,email")
      .eq("id", signedInUser.id)
      .maybeSingle();

    if (!profileError && profileData?.status === "banned") {
      await supabase.auth.signOut();
      router.replace(`/banned?email=${encodeURIComponent(profileData.email ?? values.email)}`);
      router.refresh();
      return;
    }

    router.replace(`/dashboard${referralSuffix}`);
    router.refresh();
  }

  async function google() {
    const referralSuffix = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "";
    window.location.assign(`/auth/google${referralSuffix}`);
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <Input label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <Input label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} error={form.formState.errors.password?.message} {...form.register("password")} />
      {mode === "register" && referralCode ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">Referral code applied: {referralCode}</p> : null}
      {serverError ? <p className="rounded-md bg-red-50 p-3 text-sm font-medium text-danger">{serverError}</p> : null}
      <Button loading={loading} type="submit">{mode === "login" ? "Login" : "Create account"}</Button>
      <Button type="button" variant="secondary" onClick={google}><Chrome className="h-4 w-4" aria-hidden />Continue with Google</Button>
    </form>
  );
}
