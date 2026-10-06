"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csrfFetch } from "@/lib/csrf";

export function PasswordResetForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const res = await csrfFetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    setLoading(false);
    setMessage(data.error ?? data.message ?? "Password reset email sent.");
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {message ? <p className="rounded-md bg-zinc-50 p-3 text-sm font-medium text-zinc-700">{message}</p> : null}
      <Button loading={loading}>Send reset link</Button>
    </form>
  );
}
