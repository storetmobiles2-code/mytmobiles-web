import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/misc";

export function PolicyPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: title }]} />
      <article className="card prose-policy mx-auto mt-4 max-w-3xl p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {updated && <p className="mt-1 text-sm text-ink-500">Last updated: {updated}</p>}
        <div className="mt-6">{children}</div>
      </article>
    </div>
  );
}

export function ContactLine({ email, phone }: { email: string; phone: string }) {
  if (!email && !phone) return <>through the <a href="/contact">contact page</a></>;
  return (
    <>
      {phone && <>by phone at <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a></>}
      {phone && email && " or "}
      {email && <>by email at <a href={`mailto:${email}`}>{email}</a></>}
    </>
  );
}
