import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return (
    <section className="card p-5">
      <h1 className="mb-4 text-xl font-extrabold">Saved addresses</h1>
      <AddressBook addresses={addresses} />
    </section>
  );
}
