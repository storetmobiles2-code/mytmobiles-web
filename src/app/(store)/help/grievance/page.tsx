import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEMO } from "@/lib/demo";
import { getPublicSettings } from "@/lib/public-data";
import { formatIST, GRIEVANCE_STATUS_LABEL, grievanceStatusTone, normaliseTicket } from "@/lib/grievances/rules";
import { ContactLine, PolicyPage } from "@/components/layout/policy-page";
import { GrievanceOfficerCard } from "@/components/grievance/grievance-officer";
import { GrievanceForm, TrackGrievanceForm } from "@/components/grievance/grievance-forms";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Complaints & grievances",
  description: "File a complaint with myT Mobiles and track it with your ticket number.",
  alternates: { canonical: "/help/grievance" },
};

export default async function GrievancePage(props: PageProps<"/help/grievance">) {
  const s = await getPublicSettings();
  const officer = s.grievanceOfficer;
  const phone = officer.phone || s.supportPhone;
  const email = officer.email || s.supportEmail;

  if (DEMO) {
    return (
      <PolicyPage title="Complaints & grievances">
        <Intro />
        <GrievanceOfficerCard officer={officer} showLink={false} />
        <h2>File a complaint</h2>
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This is a preview of the online store, so complaints can&apos;t be filed or tracked here.{" "}
          {phone || email ? <>Please contact us <ContactLine email={email} phone={phone} />.</> : <>Please visit the store.</>}
        </p>
      </PolicyPage>
    );
  }

  const sp = await props.searchParams;
  const ticket = typeof sp.ticket === "string" ? (normaliseTicket(sp.ticket) ?? undefined) : undefined;
  const order = typeof sp.order === "string" ? sp.order.trim().toUpperCase().slice(0, 30) : undefined;
  const user = await getCurrentUser();
  const mine = user
    ? await db.grievance.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, ticket: true, status: true, createdAt: true } })
    : [];

  return (
    <PolicyPage title="Complaints & grievances">
      <Intro />
      <GrievanceOfficerCard officer={officer} showLink={false} />
      {!officer.name && (phone || email) && <p>You can also reach us <ContactLine email={email} phone={phone} />.</p>}

      <h2>File a complaint</h2>
      <GrievanceForm prefill={{ name: user?.name, email: user?.email, phone: user?.phone ?? undefined, orderNumber: order }} />

      <h2 id="track">Track a complaint</h2>
      <p>Enter the ticket number and the email address you used when filing the complaint.</p>
      <TrackGrievanceForm ticket={ticket} />

      {mine.length > 0 && (
        <>
          <h2>Your complaints</h2>
          <ul className="!ml-0 !list-none divide-y divide-ink-100 rounded-2xl border border-ink-200">
            {mine.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-mono font-semibold text-ink-900">{g.ticket}</span>
                  <span className="block text-xs text-ink-500">Filed {formatIST(g.createdAt, false)}</span>
                </span>
                <Badge tone={grievanceStatusTone(g.status)}>{GRIEVANCE_STATUS_LABEL[g.status]}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </PolicyPage>
  );
}

function Intro() {
  return (
    <>
      <p>If something has gone wrong with an order, a delivery, a refund or a product, tell us here. Each complaint gets a ticket number, which you can use to track it.</p>
      <ul>
        <li>We acknowledge every complaint within <strong>48 hours</strong>.</li>
        <li>We resolve it within <strong>one month</strong> of receiving it.</li>
      </ul>
      <p className="text-sm text-ink-500">
        As required by the Consumer Protection (E-Commerce) Rules, 2020. For quick help with an open order, you can also use <Link href="/account/orders">My orders</Link>.
      </p>
    </>
  );
}
