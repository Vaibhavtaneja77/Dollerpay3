"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Building2, CreditCard, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { csrfFetch } from "@/lib/csrf";
import { maskAccount } from "@/lib/utils";

type Method = {
  id: string;
  type: "upi" | "bank";
  display_name: string | null;
  upi_id: string | null;
  qr_path?: string | null;
  account_number: string | null;
  bank_name: string | null;
  account_holder_name?: string | null;
  ifsc?: string | null;
  is_default?: boolean;
};

const MAX_METHODS = 5;

export function PaymentMethodManager({ initialMethods }: { initialMethods: Method[] }) {
  const [methods, setMethods] = useState(initialMethods);
  const [type, setType] = useState<"upi" | "bank">("upi");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const toast = useToast();

  const limitReached = methods.length >= MAX_METHODS;
  const defaultMethod = useMemo(() => methods.find((method) => method.is_default) ?? methods[0], [methods]);

  function methodLabel(method: Method) {
    if (method.type === "upi") return method.display_name || "UPI method";
    return method.display_name || method.bank_name || "Bank method";
  }

  function methodValue(method: Method) {
    if (method.type === "upi") return method.upi_id;
    return `${method.bank_name || "Bank"} • ${maskAccount(method.account_number)}`;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limitReached) {
      toast.show("Method limit reached", { description: "You can add up to 5 payout methods.", variant: "error" });
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "").trim();

    if (type === "upi" && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(value("upi_id"))) {
      toast.show("Enter a valid UPI ID.", { variant: "error" });
      return;
    }

    if (type === "bank") {
      const missingBankDetails = !value("account_holder_name") || !value("bank_name") || !value("account_number") || !value("ifsc");
      if (missingBankDetails) {
        toast.show("Add account holder, bank name, account number, and IFSC.", { variant: "error" });
        return;
      }
      if (!/^[0-9]{9,18}$/.test(value("account_number"))) {
        toast.show("Account number must be 9 to 18 digits.", { variant: "error" });
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value("ifsc").toUpperCase())) {
        toast.show("Enter a valid IFSC code.", { variant: "error" });
        return;
      }
    }

    setLoading(true);

    const request = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        type === "upi"
          ? { type, upi_id: value("upi_id"), display_name: value("display_name") || null }
          : {
              type,
              account_holder_name: value("account_holder_name"),
              bank_name: value("bank_name"),
              account_number: value("account_number"),
              ifsc: value("ifsc").toUpperCase(),
              display_name: value("display_name") || null
            }
      )
    };

    const res = await csrfFetch("/api/payment-methods", request);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const fieldMessage = data.fields ? Object.values(data.fields).flat().find(Boolean) : null;
      return toast.show(String(fieldMessage ?? data.error ?? "Payment method failed validation"), { variant: "error" });
    }

    setMethods((current) => [data.payment_method, ...current]);
    toast.show("Payment method added");
    formElement.reset();
  }

  async function remove(id: string) {
    setUpdatingId(id);
    const res = await csrfFetch(`/api/payment-methods/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setUpdatingId(null);
    if (!res.ok) return toast.show(data?.error ?? "This method cannot be deleted right now", { variant: "error" });
    setMethods((current) => current.filter((method) => method.id !== id));
    toast.show("Payment method deleted");
  }

  async function setDefault(id: string) {
    setUpdatingId(id);
    const res = await csrfFetch(`/api/payment-methods/${id}`, { method: "PATCH" });
    const data = await res.json();
    setUpdatingId(null);
    if (!res.ok) return toast.show(data.error ?? "Could not set default method", { variant: "error" });
    setMethods((current) =>
      current
        .map((method) => ({ ...method, is_default: method.id === id }))
        .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    );
    toast.show("Default payment method updated");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="grid gap-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Payout methods</h2>
              <p className="mt-1 text-sm text-zinc-600">Add up to 5 payment methods and choose one default method for faster sell order setup.</p>
            </div>
            <div className="w-fit rounded-full border border-line bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-700">
              {methods.length}/{MAX_METHODS} methods used
            </div>
          </div>

          {defaultMethod ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <p className="text-sm font-semibold">Default payment method</p>
              </div>
              <p className="mt-2 text-sm text-emerald-800">{methodLabel(defaultMethod)}</p>
              <p className="mt-1 text-sm text-emerald-700">{methodValue(defaultMethod)}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-line bg-zinc-50 p-4 text-sm text-zinc-600">
              No payout methods added yet.
            </div>
          )}
        </div>

        <div className="grid gap-3">
          {methods.map((method) => {
            const isDefault = Boolean(method.is_default);
            return (
              <div key={method.id} className={`rounded-lg border p-4 shadow-sm ${isDefault ? "border-emerald-300 bg-emerald-50/70" : "border-line bg-white"}`}>
                <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${method.type === "upi" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                      {method.type === "upi" ? <CreditCard className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{methodLabel(method)}</p>
                        {isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all text-sm text-zinc-600">{methodValue(method)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
                    <Button
                      variant="secondary"
                      disabled={isDefault || updatingId === method.id}
                      loading={updatingId === method.id && !isDefault}
                      onClick={() => setDefault(method.id)}
                    >
                      {isDefault ? "Default set" : "Set default"}
                    </Button>
                    <Button variant="ghost" aria-label="Delete payment method" disabled={updatingId === method.id} onClick={() => remove(method.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5" onSubmit={add}>
        <div>
          <h2 className="font-semibold">Add payout method</h2>
          <p className="mt-1 text-sm text-zinc-600">Save UPI or bank payout details. Digital Erupee is added fresh on each sell order.</p>
        </div>

        <div className="grid grid-cols-2 rounded-lg border border-line bg-zinc-50 p-1">
          <button type="button" className={`rounded-md px-2 py-2 text-sm font-medium ${type === "upi" ? "bg-white shadow-sm" : "text-zinc-600"}`} onClick={() => setType("upi")}>UPI</button>
          <button type="button" className={`rounded-md px-2 py-2 text-sm font-medium ${type === "bank" ? "bg-white shadow-sm" : "text-zinc-600"}`} onClick={() => setType("bank")}>Bank</button>
        </div>

        {type === "upi" ? (
          <Input label="UPI ID" name="upi_id" placeholder="name@bank" required />
        ) : null}

        {type === "bank" ? (
          <>
            <Input label="Display name" name="display_name" placeholder="Primary bank" />
            <Input label="Account holder name" name="account_holder_name" required />
            <Input label="Bank name" name="bank_name" required />
            <Input label="Account number" name="account_number" required />
            <Input label="IFSC" name="ifsc" required />
          </>
        ) : null}

        {limitReached ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            You have reached the 5-method limit. Delete an existing method to add a new one.
          </div>
        ) : null}

        <Button loading={loading} disabled={limitReached}>
          {limitReached ? "Limit reached" : "Add method"}
        </Button>
      </form>
    </div>
  );
}
