"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";

type Settings = {
  usdt_inr_rate: string;
  platform_fee_percent: string;
  min_sell_amount: string;
  min_deposit_amount: string;
  max_sell_amount: string;
  admin_wallet_address: string;
  admin_wallet_qr_path?: string | null;
  supported_network: string;
  processing_message: string;
  maintenance_mode: boolean;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    form.set("platform_fee_percent", "0");
    form.set("maintenance_mode", form.get("maintenance_mode") === "on" ? "true" : "false");
    const res = await csrfFetch("/api/admin/settings", { method: "POST", body: form });
    setLoading(false);
    toast.show(res.ok ? "Settings saved" : "Settings could not be saved");
    if (res.ok) router.refresh();
  }
  return (
    <form className="grid max-w-2xl gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6" onSubmit={submit}>
      <Input label="USDT to INR rate" name="usdt_inr_rate" defaultValue={settings.usdt_inr_rate} />
      <Input label="Minimum sell amount" name="min_sell_amount" defaultValue={settings.min_sell_amount} />
      <Input label="Minimum top-up amount" name="min_deposit_amount" defaultValue={settings.min_deposit_amount ?? "25"} />
      <Input label="Maximum sell amount" name="max_sell_amount" defaultValue={settings.max_sell_amount} />
      <Input label="Admin wallet address" name="admin_wallet_address" defaultValue={settings.admin_wallet_address} />
      <label className="grid gap-2 text-sm font-medium">
        <span>Admin wallet QR code image</span>
        <input
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          name="admin_wallet_qr"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        />
        {settings.admin_wallet_qr_path ? <span className="break-all text-xs font-normal text-zinc-500">Current QR: {settings.admin_wallet_qr_path}</span> : null}
      </label>
      <Input label="Supported network" name="supported_network" defaultValue={settings.supported_network} />
      <Input label="Processing message" name="processing_message" defaultValue={settings.processing_message} />
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="maintenance_mode" defaultChecked={settings.maintenance_mode} /> Maintenance mode</label>
      <Button loading={loading}>Save settings</Button>
    </form>
  );
}
