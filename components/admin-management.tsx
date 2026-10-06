"use client";

import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { formatIstDate } from "@/lib/utils";

type PermissionKey =
  | "can_manage_orders"
  | "can_manage_deposits"
  | "can_manage_referrals"
  | "can_manage_users"
  | "can_manage_wallets"
  | "can_manage_settings"
  | "can_manage_admins";

type AdminRow = {
  email: string;
  created_at: string;
  permissions: Record<PermissionKey, boolean>;
};

const permissionLabels: Array<{ key: PermissionKey; label: string }> = [
  { key: "can_manage_orders", label: "Orders" },
  { key: "can_manage_deposits", label: "Top-ups" },
  { key: "can_manage_referrals", label: "Referrals" },
  { key: "can_manage_users", label: "Users" },
  { key: "can_manage_wallets", label: "Wallets" },
  { key: "can_manage_settings", label: "Settings" },
  { key: "can_manage_admins", label: "Admins" }
];

const defaultPermissions = Object.fromEntries(permissionLabels.map(({ key }) => [key, key === "can_manage_orders" || key === "can_manage_deposits" || key === "can_manage_referrals"])) as Record<PermissionKey, boolean>;

export function AdminManagement({ admins, currentEmail }: { admins: AdminRow[]; currentEmail?: string | null }) {
  const [rows, setRows] = useState(admins);
  const [email, setEmail] = useState("");
  const [newPermissions, setNewPermissions] = useState(defaultPermissions);
  const [loading, setLoading] = useState("");
  const toast = useToast();

  async function addAdmin(event: React.FormEvent) {
    event.preventDefault();
    setLoading("add");
    const res = await csrfFetch("/api/admin/admins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, ...newPermissions })
    });
    const data = await res.json().catch(() => null);
    setLoading("");
    if (!res.ok) return toast.show(data?.error ?? "Admin could not be added.", { variant: "error" });

    const normalizedEmail = email.trim().toLowerCase();
    setRows((current) => [
      { email: normalizedEmail, created_at: new Date().toISOString(), permissions: newPermissions },
      ...current.filter((row) => row.email !== normalizedEmail)
    ]);
    setEmail("");
    toast.show("Admin saved");
  }

  async function updateAdmin(row: AdminRow, permissions: Record<PermissionKey, boolean>) {
    setLoading(row.email);
    const res = await csrfFetch(`/api/admin/admins/${encodeURIComponent(row.email)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(permissions)
    });
    const data = await res.json().catch(() => null);
    setLoading("");
    if (!res.ok) return toast.show(data?.error ?? "Permissions could not be updated.", { variant: "error" });
    setRows((current) => current.map((item) => item.email === row.email ? { ...item, permissions } : item));
    toast.show("Permissions updated");
  }

  async function removeAdmin(row: AdminRow) {
    setLoading(`delete:${row.email}`);
    const res = await csrfFetch(`/api/admin/admins/${encodeURIComponent(row.email)}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setLoading("");
    if (!res.ok) return toast.show(data?.error ?? "Admin could not be removed.", { variant: "error" });
    setRows((current) => current.filter((item) => item.email !== row.email));
    toast.show("Admin removed");
  }

  return (
    <section className="grid max-w-4xl gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Admin access</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">Add admin emails and control which actions each admin can perform.</p>
      </div>

      <form className="grid gap-3 rounded-lg border border-line bg-zinc-50 p-3 sm:p-4" onSubmit={addAdmin}>
        <Input label="Admin email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PermissionGrid value={newPermissions} onChange={setNewPermissions} />
        <Button loading={loading === "add"} disabled={!email.trim()}>Add admin</Button>
      </form>

      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.email} className="rounded-lg border border-line p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-ink">{row.email}</p>
                <p className="mt-1 text-xs text-zinc-500">Added {formatIstDate(row.created_at)}</p>
              </div>
              <Button
                variant="danger"
                className="h-10 w-full px-3 sm:w-auto"
                disabled={row.email === currentEmail?.trim().toLowerCase()}
                loading={loading === `delete:${row.email}`}
                onClick={() => removeAdmin(row)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove
              </Button>
            </div>
            <div className="mt-4">
              <PermissionGrid
                value={row.permissions}
                disabled={loading === row.email}
                onChange={(permissions) => updateAdmin(row, permissions)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PermissionGrid({
  value,
  onChange,
  disabled
}: {
  value: Record<PermissionKey, boolean>;
  onChange: (value: Record<PermissionKey, boolean>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {permissionLabels.map(({ key, label }) => {
        const checked = value[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium ${checked ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-700 hover:bg-zinc-50"}`}
            onClick={() => onChange({ ...value, [key]: !checked })}
          >
            {checked ? <ShieldCheck className="h-4 w-4" aria-hidden /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
