import Link from "next/link";
import { Mail, Phone, UserRoundCheck } from "lucide-react";

export interface GrievanceOfficerInfo {
  name: string;
  designation: string;
  email: string;
  phone: string;
}

/** The grievance officer's published details (Rule 4(4)). Renders nothing until a name is set. */
export function GrievanceOfficerCard({ officer, showLink = true }: { officer: GrievanceOfficerInfo; showLink?: boolean }) {
  if (!officer.name) return null;
  return (
    <section id="grievance-officer" aria-labelledby="grievance-officer-heading" className="my-6 rounded-2xl border border-ink-200 bg-ink-50 p-5">
      <h2 id="grievance-officer-heading" className="!mt-0 !mb-2 flex items-center gap-2 !text-lg">
        <UserRoundCheck className="h-5 w-5 text-brand-600" aria-hidden="true" /> Grievance officer
      </h2>
      <p className="font-semibold !text-ink-900">
        {officer.name}
        {officer.designation && <span className="font-normal text-ink-700">, {officer.designation}</span>}
      </p>
      <ul className="!ml-0 mt-2 !list-none space-y-1.5 text-sm">
        {officer.phone && (
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <a href={`tel:${officer.phone.replace(/[\s\-()]/g, "")}`}>{officer.phone}</a>
          </li>
        )}
        {officer.email && (
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <a href={`mailto:${officer.email}`}>{officer.email}</a>
          </li>
        )}
      </ul>
      <p className="mt-3 text-sm">
        We acknowledge every complaint within 48 hours and resolve it within one month of receiving it.
        {showLink && (
          <>
            {" "}
            <Link href="/help/grievance">File or track a complaint</Link>.
          </>
        )}
      </p>
    </section>
  );
}
