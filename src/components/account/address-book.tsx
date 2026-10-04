"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAddress } from "@/app/actions/account";
import { AddressForm, type AddressValues } from "./address-form";
import { Badge } from "@/components/ui/misc";

export function AddressBook({ addresses }: { addresses: (AddressValues & { id: string })[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="rounded-xl border border-ink-200 p-4">
            <AddressForm initial={a} onSaved={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-200 p-4 text-sm">
            <div>
              <p className="font-semibold">{a.fullName} <Badge className="ml-1">{a.type}</Badge> {a.isDefault && <Badge tone="brand">Default</Badge>}</p>
              <p className="mt-1 text-ink-700">{[a.line1, a.line2, a.landmark, a.city, `${a.state} ${a.pincode}`].filter(Boolean).join(", ")}</p>
              <p className="text-ink-500">Mobile: {a.phone}</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(a.id)} className="font-semibold text-brand-700 hover:underline">Edit</button>
              <button type="button" disabled={pending} onClick={() => { if (confirm("Delete this address?")) start(async () => { await deleteAddress(a.id); router.refresh(); }); }} className="font-semibold text-danger-700 hover:underline">Delete</button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <div className="rounded-xl border border-ink-200 p-4">
          <AddressForm onSaved={() => { setEditing(null); router.refresh(); }} onCancel={addresses.length ? () => setEditing(null) : undefined} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="w-full rounded-xl border-2 border-dashed border-ink-300 py-4 font-semibold text-brand-700 hover:border-brand-400">+ Add a new address</button>
      )}
    </div>
  );
}
