import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { acknowledgeBy, formatIST, GRIEVANCE_STATUS_LABEL, resolveBy } from "@/lib/grievances/rules";
import { sendMail } from "./mailer";
import { button, emailLayout, escapeHtml } from "./layout";

const FOOTER = "You received this email because a complaint was filed with myT Mobiles using this address.";
const trackUrl = (ticket: string) => siteUrl(`/help/grievance?ticket=${encodeURIComponent(ticket)}#track`);

async function officerLine(): Promise<{ html: string; text: string }> {
  const s = await getSettings();
  if (!s.grievanceOfficerName) return { html: "", text: "" };
  const contact = [s.grievanceOfficerEmail, s.grievanceOfficerPhone].filter(Boolean).join(" · ");
  const who = `${s.grievanceOfficerName}${s.grievanceOfficerDesignation ? `, ${s.grievanceOfficerDesignation}` : ""}`;
  return {
    html: `<p style="font-size:13px;color:#6b6b80">Grievance officer: ${escapeHtml(who)}${contact ? `<br>${escapeHtml(contact)}` : ""}</p>`,
    text: `\nGrievance officer: ${who}${contact ? ` (${contact})` : ""}`,
  };
}

/** Confirms receipt with the ticket number and the deadlines. Never throws. */
export async function sendGrievanceAcknowledgement(grievanceId: string): Promise<void> {
  try {
    const g = await db.grievance.findUnique({ where: { id: grievanceId } });
    if (!g) return;
    const officer = await officerLine();
    const url = trackUrl(g.ticket);
    const ack = formatIST(acknowledgeBy(g.createdAt));
    const due = formatIST(resolveBy(g.createdAt), false);
    const html = emailLayout({
      storeName: "myT Mobiles",
      preheader: `Your complaint ticket number is ${g.ticket}.`,
      heading: "We've received your complaint",
      footer: FOOTER,
      bodyHtml: `<p>Hi ${escapeHtml(g.name.split(" ")[0])}, thank you for writing to us.</p>
<p style="font-size:18px"><strong>Ticket ${escapeHtml(g.ticket)}</strong></p>
<p>Our grievance officer will acknowledge your complaint by <strong>${escapeHtml(ack)}</strong> and resolve it by <strong>${escapeHtml(due)}</strong>.</p>
${g.orderNumber ? `<p style="font-size:13px;color:#6b6b80">Order ${escapeHtml(g.orderNumber)}</p>` : ""}
<p>You can track it with the ticket number and this email address.</p>
${button(url, "Track your complaint")}
${officer.html}`,
    });
    const text = `We've received your complaint.\n\nTicket: ${g.ticket}\nAcknowledgement by: ${ack}\nResolution by: ${due}\n\nTrack it: ${url}${officer.text}`;
    await sendMail({ to: g.email, subject: `Complaint received — ${g.ticket}`, html, text });
  } catch (err) {
    console.error(`[mail] grievance acknowledgement failed for ${grievanceId}`, err);
  }
}

/** Sends a staff update (status change, note or resolution) to the consumer. Never throws. */
export async function sendGrievanceUpdate(grievanceId: string, message: string): Promise<void> {
  try {
    const g = await db.grievance.findUnique({ where: { id: grievanceId } });
    if (!g) return;
    const officer = await officerLine();
    const url = trackUrl(g.ticket);
    const status = GRIEVANCE_STATUS_LABEL[g.status];
    const heading = g.status === "RESOLVED" ? "Your complaint is resolved" : `Update on your complaint`;
    const html = emailLayout({
      storeName: "myT Mobiles",
      preheader: `${g.ticket}: ${status}`,
      heading,
      footer: FOOTER,
      bodyHtml: `<p>Hi ${escapeHtml(g.name.split(" ")[0])},</p>
<p style="color:#6b6b80;font-size:13px">Ticket <strong>${escapeHtml(g.ticket)}</strong> · Status: <strong>${escapeHtml(status)}</strong></p>
<p style="white-space:pre-line">${escapeHtml(message)}</p>
${officer.html ? "<p>If you are not satisfied with this response, please contact our grievance officer.</p>" : ""}
${button(url, "Track your complaint")}
${officer.html}`,
    });
    const text = `${heading}\n\nTicket: ${g.ticket}\nStatus: ${status}\n\n${message}\n\nTrack it: ${url}${officer.text}`;
    await sendMail({ to: g.email, subject: `${g.status === "RESOLVED" ? "Resolved" : "Update"} — ${g.ticket}`, html, text });
  } catch (err) {
    console.error(`[mail] grievance update failed for ${grievanceId}`, err);
  }
}
