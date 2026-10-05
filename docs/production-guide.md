# Running myT Mobiles online in production

What it takes to set up, run and maintain the store as a real business in India. Researched October 2026. Prices and rules change, so the figures to re-check are marked **(verify)**. Have a chartered accountant and a lawyer confirm the tax and legal sections before launch.

---

## 1. At a glance

| | |
|---|---|
| **One-time setup** | 2–4 weeks, mostly waiting on payment-gateway KYC and getting legal pages reviewed |
| **Fixed running cost** | About ₹4,000–7,000 a month for hosting, database, email, domain and monitoring (§4). Payment and shipping fees are extra, per order. |
| **Daily effort** | 15–30 minutes, plus packing time: read the daily brief, pack and ship by the 2 PM cutoff, handle returns, answer customers |
| **Weekly effort** | About 1 hour: review agent PRs (new products, photos), the stock import, the audit report |
| **Monthly effort** | About 1–2 hours: dependency-update PR, settlement reconciliation, GST data for the accountant |
| **People** | Owner (approves PRs, money matters); one staff member (orders, packing, stock imports, customer messages, grievance officer); a developer on call for incidents and upgrades, a few hours a month |

---

## 2. One-time setup

### 2.1 Business and legal

- [ ] **GSTIN** for the business, and the dispatch address used for GST, in Admin → Settings. Invoices show it.
- [ ] **Current bank account** in the business name, for payment-gateway settlements.
- [ ] **Razorpay account and KYC**: PAN, GST certificate, bank proof, business address proof, and a live website with Terms, Privacy, Refund/Returns, Shipping and Contact pages. The store has all of these: `/terms`, `/privacy`, `/help/returns`, `/help/shipping`, `/contact`. Activation usually takes a few working days **(verify)**.
- [ ] **Grievance officer**: name a person and publish their name, phone and email. This is required by the Consumer Protection (E-Commerce) Rules, 2020 (§5.1). The site shows support contacts today but **has no grievance-officer name field yet** (§9).
- [ ] **Legal review** of `/terms`, `/privacy` and the returns policy, against the store's actual practice.
- [ ] **Authorised-dealer status per brand.** Only claim "authorised" or "genuine" where it's true. It also affects whether brand photos may be reused (§5.5).
- [ ] **Shop & Establishment / trade licence** is already held for the physical shop. Check whether online sales from the same premises need any update **(verify locally)**.

### 2.2 Accounts and services

| Need | Recommended | Alternative | Notes |
|---|---|---|---|
| Domain | `.in` or `.com` from any registrar | — | About ₹600–1,200 a year **(verify)**. Turn on auto-renew and registrar lock. |
| Hosting (app) | **Vercel Pro**: $20 per developer seat per month, with $20 of usage included (search, 2026) | A VPS (AWS Lightsail or DigitalOcean, Mumbai/Bangalore) running the included `docker-compose.yml` | Vercel means no servers to patch. A VPS is cheaper but you own updates, TLS and backups. |
| Database | **Supabase Pro** ($25 a month, includes compute credit) in the Mumbai region | Neon Launch (usage-based: $0.106 per CU-hour, $0.35 per GB-month, no minimum); AWS RDS Mumbai | Pick a region close to the app. Turn on daily backups or point-in-time recovery. |
| Email | **Amazon SES** (Mumbai), about $0.10 per 1,000 emails **(verify)** | Zoho ZeptoMail, Brevo | Set SPF, DKIM and DMARC on the domain. Configure SMTP_* in the host. |
| DNS and protection | Cloudflare (free plan) | The registrar's DNS | DNS, DDoS protection and basic WAF rules. With Vercel, keep proxying off for Vercel records, or follow Vercel's Cloudflare guide. |
| Uptime monitoring | UptimeRobot / Better Stack (free plan) | — | Monitor `/api/health` every minute, with alerts to the owner's phone. |
| Error tracking | Sentry (free developer plan) | Host logs only | Not wired in yet (§9). |
| Payments | **Razorpay**: 2% + 18% GST, about **2.36% effective**, on domestic cards, UPI, netbanking and wallets; premium methods (EMI, Amex, corporate cards) 3% + GST; no setup or annual fee (2026). Custom pricing above about ₹5 lakh a month. | Cashfree, PayU | Card data never touches our servers (Razorpay Checkout), so the store stays out of most PCI DSS scope. |
| Shipping | **Shiprocket**: plans from ₹199 to ₹799 a month, average shipment cost about ₹36–45 depending on plan (2026) | Delhivery or a direct courier contract | The store doesn't integrate a courier yet. Staff create labels in the aggregator and paste the AWB into Admin (§9). |
| AI agents | Anthropic API key with a monthly spend limit | Claude Code subscription for interactive use | See docs/agents.md. Budget about $20–100 a month depending on how many products are onboarded **(estimate)**. |

### 2.3 Deploying (Vercel + Supabase example)

1. Create the database (Mumbai region). Copy the **pooled** connection string as `DATABASE_URL`, and keep a direct one for migrations.
2. On your computer: `DATABASE_URL=<direct> npx prisma migrate deploy && npx prisma db seed`, with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set.
3. In Vercel:
   - import the GitHub repository;
   - set the function region to Mumbai (`bom1`);
   - add every variable from `.env.example`;
   - use a long random `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

   The build reads the database, so `DATABASE_URL` must be set for builds too.
4. Domain: add it in Vercel and point DNS at it. HTTPS is automatic.
5. Razorpay:
   - add the live keys;
   - create the webhook `https://<domain>/api/payments/razorpay/webhook` with the events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` and `refund.failed`;
   - set `RAZORPAY_WEBHOOK_SECRET`.
6. Cron: call `/api/cron/expire-orders` every 5–10 minutes. Either use Vercel Cron (Pro plan) or set `CRON_VIA_GITHUB=true` (see docs/agents.md).
7. GitHub (see docs/agents.md → Setup):
   - branch protection on `main`;
   - the production environment and its secrets;
   - optionally the agents.
8. Admin → Settings: legal name, GSTIN, address, support contacts, shipping and COD rules. The dashboard checklist must be empty before launch.

### 2.4 Go-live checklist

- [ ] Admin → Dashboard shows no setup gaps. Store details and GSTIN appear on a test invoice.
- [ ] **Live test orders:**
  - one COD order and one UPI order for ₹1–10 on a test product;
  - a refund of the UPI order, which must reach the account;
  - the order emails arrive and aren't in spam;
  - the invoice number format is correct.
- [ ] The webhook shows "delivered" in the Razorpay dashboard.
- [ ] The cron runs: a test online order left unpaid releases its stock after the payment window.
- [ ] `npm run catalog -- report` shows no live product priced above MRP and no live product missing legal details.
- [ ] Legal pages reviewed. The grievance officer is published.
- [ ] Uptime monitor and alerts are working. A restore from backup has been tested once (§6.3).
- [ ] Search Console and Bing Webmaster: verify the domain and submit `/sitemap.xml`.
- [ ] Remove or disable the GitHub Pages preview, or keep it clearly marked as a preview. It's `noindex` and says it can't take orders.

---

## 3. Running it

### Daily

- **07:45 IST**: read the operations brief, from the scheduled job or by asking the ops-monitor.
- Pack and ship the confirmed orders. Orders paid by **2 PM** are promised next-day dispatch: Admin → Orders → Mark packed, then Mark shipped with the courier and AWB.
- Review return requests and pay COD refunds by bank transfer, then mark them refunded. Prepaid refunds go back through Razorpay automatically.
- **Customer messages and grievances:** acknowledge within 48 hours and resolve within one month (§5.1).

### Each time stock changes (at least weekly)

1. Export the stock sheet from the POS.
2. The stock-keeper reviews it.
3. Fix any flagged rows in the POS.
4. Import it in Admin → Inventory.
5. New items go to the product-onboarder, which opens PRs. The owner reviews and merges them.

Sell online, ship, then bill the sale in the POS, so the next export matches. Units in unshipped online orders are subtracted automatically at import.

### Weekly

- Review the agents' PRs: new products, photos, the site audit. Merging a product PR updates the live site.
- Look at Admin → Analytics: searches with no results (missing products), top viewed products, conversion.
- Reconcile Razorpay settlements against paid orders for the week.

### Monthly

- Merge the release-manager's dependency and security PR after CI passes, then check the live site.
- Give the accountant the GST data. Until an export exists (§9), use Admin → Orders and the invoices.
- Check costs: hosting, database, email, API spend.

### Quarterly

- **Test a restore** of the database backup into a scratch database, and confirm the site runs on it.
- Access review: remove admin accounts of people who left, and rotate `CRON_SECRET`, database passwords and API keys.
- Re-read the legal pages against current practice. Check for rule changes (GST rates, DPDP timelines).

### Yearly

Renew the domain (auto-renew on), review policies, review the hosting plan and payment pricing, and do a DPDP readiness review (§5.3).

---

## 4. Monthly cost estimate

Low traffic, roughly 1,000–3,000 visitors a day and 100–300 online orders a month. USD is converted at about ₹85 **(verify)**.

| Item | Monthly |
|---|---|
| Vercel Pro, 1 developer seat | $20, about ₹1,700 |
| Supabase Pro database | $25, about ₹2,100 |
| Email (SES), monitoring, Cloudflare | about ₹100, mostly free tiers |
| Domain (yearly ÷ 12) | about ₹80 |
| AI agents (API usage, capped) | about ₹1,700–8,500 |
| **Fixed total** | **about ₹4,000–7,000 + agents** |
| Razorpay | 2.36% of online sales (₹23,600 on ₹10 lakh). COD has no gateway fee, but the courier charges a COD fee. |
| Shipping | Plan ₹199–799, plus about ₹36–45 a shipment at 500 g. Phones are light; TVs and coolers cost much more. Get a quote. |

The cheapest option is a single VPS running Docker Compose (about ₹1,000–2,000 a month), with more work for you: OS updates, backups, monitoring, TLS.

---

## 5. Legal and tax requirements (India)

This is a summary to discuss with your CA and lawyer, not legal advice.

### 5.1 Consumer Protection (E-Commerce) Rules, 2020

The store owns its stock and sells directly, which makes it an **inventory e-commerce entity**. It must:

- Display its **legal name, address of headquarters and branches, website details, and customer care and grievance officer contacts**, clearly on the site.
- Run a grievance process: **acknowledge complaints within 48 hours and resolve them within one month**, with a way to track complaints.
- Show the **total price with a breakdown** of other charges (delivery and COD fees are shown at checkout), plus return, refund, exchange, warranty, shipping and country-of-origin information.
- Not post fake reviews or misrepresent products. The store only accepts reviews from customers with a delivered order.
- Carry liability for authenticity if it vouches for goods being genuine.

**Gap:** the grievance officer's name (§9).

### 5.2 Legal Metrology (Packaged Commodities) Rules, 2011

E-commerce listings must show the mandatory declarations:
- name and address of the manufacturer, packer or importer;
- the commodity name and net quantity;
- **MRP inclusive of all taxes**;
- consumer-care details;
- **country of origin**.

The manufacture date is excluded online. There's no dual MRP for identical goods.

The product files require manufacturer details and country of origin before a product can go live. `catalog report` lists live products still missing them: 46 in the current seeded data. **Fill these from the boxes before launch.**

### 5.3 Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025

The Rules were notified on 13 November 2025 and phase in. The main obligations apply from **13 May 2027**:
- a clear notice and consent;
- security safeguards: encryption, access control, logging and monitoring, backups, and keeping logs for **at least one year**;
- breach notification;
- data-principal rights (access, correction, erasure);
- children's data;
- contracts with processors.

The store collects names, phones, emails and addresses only for orders, with optional marketing opt-in. Before May 2027:
- update the privacy notice to the Rules' format;
- add a data-request path (access, correction, deletion) handled within the set timelines;
- extend log retention to one year;
- write a breach runbook (§7);
- list processors: hosting, database, email, Razorpay, courier.

### 5.4 GST

- **Invoices:** issue a tax invoice for every sale (Rule 46). The store numbers invoices `PREFIX/FY/NNNNNN` and splits CGST/SGST or IGST by delivery state.
- **e-Invoicing (IRN):** mandatory for **B2B** invoices when aggregate turnover exceeds **₹5 crore** (since August 2023, still the threshold in 2026). B2C sales aren't covered at that level. If B2B sales with the buyer's GSTIN grow and turnover crosses ₹5 crore, B2B invoices need an IRN and QR code from the IRP. The store doesn't do this yet.
- **Rates:** the September 2025 GST rate rationalisation moved many goods into the 5% and 18% slabs (with 40% for a few). Phones are 18%; TVs and air conditioners moved to 18%. **Have the CA confirm the HSN code and rate for each category.** `catalog validate` warns when a product uses the old 12% or 28% slabs.
- **TCS under section 52** applies to marketplace operators collecting for other sellers, not to a store selling its own goods **(confirm with CA)**.
- **Returns:** the accountant needs monthly sales by rate and state for GSTR-1/3B. **Gap:** add an export (§9).

### 5.5 Product photos and trademarks

Manufacturer photos are copyrighted. Using them unmodified to identify the product you sell is common retail practice, and brands' dealer and partner terms often allow it. **Confirm with each brand or distributor**, especially where the shop isn't an authorised dealer. Where in doubt, photograph the actual unit in the shop.

The house rules and `catalog validate` block retailer and marketplace photos, and every image's source is recorded.

### 5.6 Cyber-security reporting (CERT-In Directions, 2022)

- Report specified cyber incidents to CERT-In **within 6 hours** of becoming aware: data breaches, ransomware, website defacement, unauthorised access and so on.
- Keep logs of ICT systems for **180 days**, stored in India.
- Synchronise clocks to an NTP time source.

Managed hosts log by default, but check retention and region. Confirm applicability for a business of this size with counsel; the safe default is to follow these rules.

### 5.7 Payments

Online card and UPI payments are processed on Razorpay's hosted checkout, so the store never sees or stores card numbers. Card tokenisation (RBI) is handled by the gateway. Keep the Razorpay dashboard secured with 2FA and limited user access.

---

## 6. Security and reliability baseline

### 6.1 Access
- Give every staff member their own admin account. Never share one; remove it when they leave.
- **Turn on two-factor sign-in** for GitHub, Vercel, the database provider, Razorpay, the domain registrar and email.
- The store's own admin login has **no 2FA yet** (§9). Use strong unique passwords meanwhile.
- Database users:
  - **app**: read/write;
  - **ops**: read-only, for the daily brief and site audit;
  - **migrations**: schema changes.
- Secrets live only in the host's environment settings and GitHub secrets. Never put them in the repository.

### 6.2 Built in already
HTTPS with HSTS, Content-Security-Policy, rate limiting on login, sign-up, order placement and pincode lookups, hashed passwords (scrypt), server-side sessions, input validation on every form, and webhook signature checks.

### 6.3 Backups and recovery
- The database provider runs daily backups, with point-in-time recovery if available, kept at least 7 days.
- Each week, a `pg_dump` to separate storage (encrypted), kept for 90 days.
- Product photos are in the git repository. Uploaded images are in the database, so they're covered by its backups.
- **Recovery targets:** lose at most 24 hours of data (or 5 minutes with point-in-time recovery). Be back up within 4 hours.
- **Restore test** every quarter (§3).

### 6.4 Monitoring
- An uptime check on `/api/health` every minute.
- The daily brief flags stuck payments, which means the cron isn't running.
- Error tracking (Sentry) is recommended (§9).
- Watch Razorpay webhook delivery in its dashboard.

---

## 7. Incident runbook

| Situation | First 15 minutes | Then |
|---|---|---|
| **Site down** | Check the host status page and `/api/health`. If the database is unreachable, check the provider's status. If a deploy just happened, **roll back** (Vercel → Deployments → previous → Promote). | Find the cause in the logs. Fix forward with a PR. Note it in the incident log. |
| **Payments failing** | Check Razorpay status and dashboard. If it's down, turn off online payment by removing the keys in hosting env, so checkout falls back to COD. | Re-enable it. Reconcile any orders that are "paid at Razorpay but pending here": the webhook and the late-payment handling recover most of them. |
| **Wrong price or MRP live** | Fix the price in the POS and re-import, or merge a product-file fix, or hide the product (Admin → Products → hide). | Honour or cancel affected orders according to your terms; contact the customers. |
| **Data breach suspected** | Rotate all secrets and database passwords; revoke sessions (`DELETE FROM "Session"`). Preserve logs. | **Report to CERT-In within 6 hours.** Under the DPDP Rules, notify the Data Protection Board and affected users. Get legal help. |
| **Bad agent change merged** | Revert the PR on GitHub (one click). For product data, the revert re-runs catalog-apply with the old file. | Tighten the agent's rules in `.claude/skills/store-rules` and add a validation rule. |

---

## 8. How the pieces fit

```
Customers ──HTTPS──► Vercel (Next.js app, Mumbai) ──► PostgreSQL (Mumbai, backups)
                         │            │                     ▲
                         │            └─► Razorpay (checkout, webhooks, refunds)
                         ├─► Email (SES/ZeptoMail)          │
                         └─► India Post pincode API         │
Staff ──► Admin panel ───┘                                  │
POS stock CSV ──► stock-keeper review ──► Admin import ─────┤
Agents ──► PRs ──► owner merges ──► CI ──► catalog-apply ───┘
Schedules: cron (order expiry) · daily ops brief · weekly audit · monthly updates
```

---

## 9. Gaps to close in the code

Ranked by importance before launch:

1. **Grievance officer details:** add name, email and phone fields to Store Settings, and show them on Contact, Terms and the footer. Needed for the E-Commerce Rules.
2. **Legal details for all live products:** fill manufacturer and country of origin (46 products today). Agents can draft them; staff confirm them from the boxes.
3. **Admin two-factor authentication** (TOTP) and **staff roles** (packing staff shouldn't change settings or prices).
4. **Admin audit log:** who changed which order, stock or setting, and when.
5. **GST and sales export:** a monthly CSV of invoices by rate, state and HSN for the accountant (GSTR-1).
6. **Error tracking:** Sentry or similar, plus log retention set to 180 days or more (CERT-In) and one year (DPDP, from 2027).
7. **Courier integration:** create labels and pickups, and import tracking (Shiprocket API), instead of copying AWBs by hand.
8. **Customer data requests** (DPDP): an export and delete-my-account flow.
9. **e-Invoicing:** only needed if B2B sales and turnover cross ₹5 crore.

The release-manager agent can take these one PR at a time.

---

## Sources

- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code GitHub Actions: https://code.claude.com/docs/en/github-actions · example workflow: https://github.com/anthropics/claude-code-action
- Consumer Protection (E-Commerce) Rules 2020:
  - https://www.indialaw.in/blog/civil/consumer-protection-e-commerce-rules/
  - https://www.mondaq.com/india/dodd-frank-consumer-protection-act/985606/the-consumer-protection-e-commerce-rules-2020
  - https://corporate.cyrilamarchandblogs.com/2020/08/consumer-protection-e-commerce-rules-need-for-more-clarity/
- Legal Metrology e-commerce declarations:
  - https://ssrana.in/corporate-laws/legal-metrology-and-packaging/
  - https://www.mondaq.com/Article/616204
- DPDP Rules 2025:
  - https://www.barandbench.com/view-point/meity-notifies-final-digital-personal-data-protection-rules-2025
  - https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified
  - https://www.ey.com/content/dam/ey-unified-site/ey-com/en-in/alerts-hub/2025/11/digital-data-protection-act-rules-notified-by-meity.pdf
- GST e-invoicing threshold:
  - https://www.incorpx.io/blog/gst-e-invoice-turnover-limit-2026
  - https://www.vatcalc.com/india/india-b2b-e-invoicing/
- CERT-In Directions 2022:
  - https://www.linklaters.com/insights/blogs/digilinks/2022/may/india-new-and-onerous-cyber-security-framework-and-breach-reporting-obligations
  - https://psalegal.com/new-cert-in-directions-overview-and-implications/
- Razorpay pricing: https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/
- Shiprocket plans: https://pricingsaas.com/companies/shiprocket
- Vercel pricing: https://makerkit.dev/blog/saas/vercel-cost
- Neon pricing: https://neon.com/pricing
- Supabase pricing: https://makerkit.dev/blog/saas/supabase-pricing
