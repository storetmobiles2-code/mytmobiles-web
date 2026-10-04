/** Minimal, inline-styled transactional email shell (renders in Gmail/Outlook). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function emailLayout(opts: { preheader: string; heading: string; bodyHtml: string; storeName: string; footer?: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14142b">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a0a0b;padding:20px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px">my<span style="color:#f8358a">T</span> <span style="font-size:14px;letter-spacing:2px;font-weight:700">MOBILES</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(opts.heading)}</h1>
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;color:#6b6b80;font-size:12px;line-height:1.5;border-top:1px solid #eee">${opts.footer ?? `You received this email because of activity on your ${escapeHtml(opts.storeName)} account.`}</td></tr>
</table></td></tr></table></body></html>`;
}

export function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#d10f68;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(label)}</a></p>`;
}
