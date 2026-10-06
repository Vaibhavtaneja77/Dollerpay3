"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { formatIstDate, formatUsdt } from "@/lib/utils";

type CouponRow = {
  code: string;
  reward_usdt: string;
  max_redemptions: number;
  redeemed_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export function CouponManagement({ coupons }: { coupons: CouponRow[] }) {
  const [rows, setRows] = useState(coupons);
  const [loading, setLoading] = useState("");
  const [active, setActive] = useState(true);
  const toast = useToast();

  async function addCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading("add");
    const form = new FormData(formElement);
    const body = {
      code: form.get("code"),
      reward_usdt: form.get("reward_usdt"),
      max_redemptions: form.get("max_redemptions"),
      active,
      expires_at: form.get("expires_at") ? new Date(String(form.get("expires_at"))).toISOString() : null
    };
    try {
      const res = await csrfFetch("/api/admin/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.show(data?.error ?? "Coupon could not be saved.", { variant: "error" });

      setRows((current) => [data.coupon, ...current.filter((row) => row.code !== data.coupon.code)]);
      formElement.reset();
      setActive(true);
      toast.show("Coupon saved");
    } catch {
      toast.show("Coupon could not be saved. Please try again.", { variant: "error" });
    } finally {
      setLoading("");
    }
  }

  async function deleteCoupon(code: string) {
    setLoading(code);
    try {
      const res = await csrfFetch("/api/admin/coupons", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.show(data?.error ?? "Coupon could not be deleted.", { variant: "error" });
      setRows((current) => current.filter((row) => row.code !== code));
      toast.show("Coupon deleted");
    } catch {
      toast.show("Coupon could not be deleted. Please try again.", { variant: "error" });
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="grid max-w-4xl gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Top-up coupons</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">Create limited coupon codes that add a USDT reward after a customer top-up is verified.</p>
      </div>

      <form className="grid gap-3 rounded-lg border border-line bg-zinc-50 p-3 sm:grid-cols-2 sm:p-4" onSubmit={addCoupon}>
        <Input label="Coupon code" name="code" placeholder="WELCOME10" autoCapitalize="characters" required />
        <Input label="Reward USDT" name="reward_usdt" inputMode="decimal" placeholder="10" required />
        <Input label="Redeem limit" name="max_redemptions" type="number" min="1" step="1" placeholder="100" required />
        <Input label="Expires at" name="expires_at" type="datetime-local" />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>
        <Button className="sm:col-span-2" loading={loading === "add"}>Create coupon</Button>
      </form>

      <div className="grid gap-3">
        {rows.length ? rows.map((coupon) => (
          <div key={coupon.code} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-semibold text-ink">{coupon.code}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${coupon.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                  {coupon.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Reward {formatUsdt(coupon.reward_usdt)} - {coupon.redeemed_count}/{coupon.max_redemptions} redeemed
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Created {formatIstDate(coupon.created_at)}
                {coupon.expires_at ? ` - Expires ${formatIstDate(coupon.expires_at)}` : ""}
              </p>
            </div>
            <Button variant="danger" className="h-10 w-full px-3 sm:w-auto" loading={loading === coupon.code} onClick={() => deleteCoupon(coupon.code)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </div>
        )) : (
          <div className="rounded-lg border border-dashed border-line p-4 text-sm text-zinc-600">No coupons created yet.</div>
        )}
      </div>
    </section>
  );
}
