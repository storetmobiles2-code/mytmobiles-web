# Maintenance agents

The store is maintained by a small team of Claude Code agents working alongside the owner and shop staff. **Agents prepare changes, people approve them.** Every change to production goes through a pull request and lands only after a person merges it.

## The team

| Agent | Handles | Typical trigger | Writes to production? |
|---|---|---|---|
| `product-onboarder` | New products, end to end: specs, MRP, legal details, official photos, product page | New stock arrives; "New product" issue | No. Opens a PR |
| `catalog-editor` | Changes to existing products: MRP, specs, colours, variants, hide/show | "Product change" issue; brand price revision | No. Opens a PR |
| `image-curator` | Fills "Photo coming soon" placeholders and fixes wrong photos, from official sources only | Weekly backlog; a reported wrong photo | No. Opens a PR |
| `stock-keeper` | Reviews each POS stock-sheet export before import: typos, price jumps, items above MRP, new items | Every stock export | No. Staff import in Admin |
| `ops-monitor` | Daily brief: orders to pack/ship, late deliveries, returns, refunds, stuck payments, sell-outs, site health | Every morning | No. Read-only |
| `site-auditor` | Weekly audit: broken pages, Lighthouse, accessibility, SEO, structured data, legal disclosures | Weekly; before campaigns | No. Report PR |
| `release-manager` | Code changes, dependency and security updates, deploy checks, rollbacks | Monthly; on advisories; CI failure | No. Opens PRs |

All of them load the shared house rules in `.claude/skills/store-rules/SKILL.md`: who owns which data, the official-photo policy, Indian legal display requirements, copy style and safety limits.

What the agents **don't** do: change orders, refunds, payments or customer data, reply to customers, or alter store settings and banners. Staff handle those in the Admin panel. The ops-monitor tells them what needs doing.

## Example: a new phone arrives

```
Shop                     POS stock sheet ──► export CSV
                                                │
stock-keeper            "1 new item: SAMSUNG A57 5G 8/256 NAVY ×3" ──► opens "New product" issue
                                                │
product-onboarder       researches samsung.com/in → specs, MRP ₹44,999, importer, country of origin
                        finds the official Navy photos → builds them → checks the contact sheet by eye
                        writes catalog/products/samsung-galaxy-a57-5g.json → validate → dry run
                        opens PR "Catalog: Samsung Galaxy A57 5G" with sources and photos
                                                │
Owner                   reviews the PR (photos, MRP, details) ──► merges
                                                │
CI (catalog-apply)      waits for the photos to deploy → applies to the production DB → refreshes cached pages
                                                │
Staff                   import the stock CSV in Admin → the product shows its price and stock and goes live
```

The selling price and stock always come from the POS export. The product file adds MRP, details, legal information and photos. Both sides match on the stock-sheet item names (`stockSheetNames`).

## How to give agents work

1. **In Claude Code** (on a computer, or at claude.ai/code on any device) with this repository open:
   - *"Use the product-onboarder to add the Samsung Galaxy A57 5G; stock-sheet names are …"*
   - *"Use the ops-monitor for today's brief."*
   - *"Use the stock-keeper on ~/Downloads/stock-2026-10-05.csv."*
2. **From GitHub** (once enabled, see Setup): open an issue with the **New product** or **Change a product** form and comment `@claude onboard this product`. The agent replies on the issue and opens a PR.
3. **On a schedule**, set up in `.github/workflows/`:
   - `scheduled-ops.yml`: the order-expiry cron every 10 minutes, and the 07:45 IST operations brief, which opens an issue when something is urgent. Neither needs an AI model.
   - `claude-agents.yml`: the site audit every Monday and the dependency and security check on the 1st of each month.

## The tools agents use

Everything an agent does goes through scripts in this repository, which a person can also run.

```bash
npm run catalog -- report                 # catalogue health: placeholders, MRP gaps, legal gaps, hidden stock
npm run catalog -- new <slug> --brand … --name …
npm run catalog -- export <slug>          # existing product → product file
npm run catalog -- images <slug>          # official photos → optimised WebP + contact sheet for review
npm run catalog -- validate [slug]        # schema + store rules
npm run catalog -- apply <slug>           # dry run; --write applies (CI does this for production)
npm run catalog -- stock-plan <csv>       # preview a stock import with warnings
npm run ops -- report                     # daily operations brief (read-only)
```

`validate` enforces the rules mechanically:
- no selling price above MRP;
- no retailer or marketplace photos;
- photo colours must match variant colours;
- no leftover TODOs;
- valid HSN code and GST rate;
- nothing goes live without photos, specs, manufacturer details and country of origin.

`apply` refuses to:
- publish a product without photos;
- lower an MRP below the current selling price;
- rename a live product's URL.

## Setup

1. **Product files in production.** In the GitHub repository settings:
   - create the environment **production**, with you as a required reviewer;
   - add the environment secrets `PRODUCTION_DATABASE_URL` and `CRON_SECRET`, and the variable `SITE_URL`;
   - set the repository variable `CATALOG_AUTO_APPLY=true`.
2. **Cron and daily brief without extra services.** Add the secrets `CRON_SECRET` and `OPS_DATABASE_URL` (a read-only database user) and the variable `SITE_URL`. Then set `CRON_VIA_GITHUB=true` and `OPS_BRIEF_ENABLED=true`. GitHub may delay scheduled runs by a few minutes, which is fine for both jobs.
3. **Agents on GitHub.**
   - Install the Claude GitHub app (https://github.com/apps/claude) on the repository.
   - Add the secret `ANTHROPIC_API_KEY`.
   - Set `CLAUDE_AGENTS_ENABLED=true`.

   Only people with write access to the repository can trigger the agents.
4. **CI** (`ci.yml`) runs on every pull request with no setup: lint, types, unit tests, product-file validation, build, and end-to-end plus accessibility tests.
5. **Branch protection on `main`:** require the CI check and one approving review.

### Costs

Agent runs use the Anthropic API.
- A product onboarding is typically a few minutes of work: research, photos and a PR.
- The weekly audit and monthly dependency check are small.
- The cron and daily brief use no AI.

Set a monthly spend limit in the Anthropic console.

## Not automated yet

- **Banners, coupons and homepage merchandising** are still done in Admin. An agent can draft copy and coupon rules on request, but there's no reviewed file format for them yet.
- **Customer messages and grievances** need a person. The law expects a named grievance officer to acknowledge complaints within 48 hours and resolve them within a month.
- **Payment reconciliation** with Razorpay settlements (the ops-monitor notes when it wasn't done) and **shipping label creation** (no courier integration yet).
