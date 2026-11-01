---
name: harness-rules
description: myT Mobiles runtime harness rules — which tier does what (deterministic code, cheap worker model, Claude), the i3 host's memory budget, the three gates on POS prices, Discord approvals and escalations. Load before changing the myBillBook sync, the POS endpoints, price guards, the i3 stack, or anything that calls an LLM at runtime.
---

# myT Mobiles — runtime harness rules

The store runs on a 3-tier harness. **No frontier model runs in a repetitive loop.** The full design and its decisions are in the approved plan (owner, 1 November 2026). This skill holds the rules any change must keep.

## Who does what

| Tier | What | Where | Tokens |
|---|---|---|---|
| 0 | Deterministic code: myBillBook polling and diff (`mbb_sync.py`), price and margin gates, canary and rollback, approvals bot, backups, WhatsApp order messages | i3 (Docker) and the store app | 0 |
| 1 | Cheap model (Haiku), single schema-bound call, `max_tokens` 600, cached: identify/route an unmapped POS item; extract specs **with verbatim quotes** from a fetched official page; flag photos | i3 `myt-agents` (identify) and GitHub Actions (onboarding) | small, only for new items |
| 2 | Claude, on the owner's Mac only: building and changing code, and escalations | Mac | on demand |

- A Tier 1 worker never writes live data. Its output becomes a Discord suggestion, an issue or a draft PR that a person approves.
- A Tier 1 worker never supplies specs, MRP, manufacturer/importer, country of origin or net quantity from its own knowledge. Extracted fields are kept only when their quote appears in the fetched official page; the rest stay empty and the product stays `draft` (store-rules).
- Prices come only from the POS. An LLM never sets or changes a price.
- If a Tier 0 job fails 3 runs in a row, or a Tier 1 output fails its schema 3 times, the harness opens a GitHub issue labelled `escalation` and posts in Discord `#alerts`. Claude picks it up on the Mac.

## Gates on POS prices

1. **Gate 1, back office:** the myBillBook token belongs to a view-only staff account. Nothing writes back to myBillBook. Renewing the token needs the owner's OTP sign-in; the bot reminds them before it expires.
2. **Gate 2, policy** (server-side, `src/lib/catalog/price-guard.ts`): no ₹0 price, nothing above MRP, no automatic move over 15%. Below-margin prices are held: the margin is checked on the shop side, so cost price never reaches the web server. A held price is stored as a `PriceHold` and waits for the owner's approval in Discord (`/api/sync/held-prices`, `HARNESS_SECRET`) or Admin → Inventory → Held prices; `above-mrp` and `zero-price` can never be approved, only fixed in the POS or with an MRP pull request.
3. **Gate 3, canary:** after a sync that changed anything, a read-only probe checks health, product pages and their rendered price. On failure it calls `POST /api/sync/pos-stock/rollback` with the sync's `auditId`, which rolls back **prices only**, for SKUs whose price hasn't changed since. Stock is never rolled back, because it reflects the shelf. The probe never places orders: a test order would reserve stock and use up a GST invoice number.

## The i3 host

- 8 GB RAM, **6,800 MB** cap for all containers together; the rest is the OS's safety margin. Every service has a `mem_limit`, and CI's `harness-budget-check` fails if their sum goes over the cap.
- Inbound ports are closed (nftables default-drop). The site is reached only through the Cloudflare tunnel; SSH only from the shop LAN.
- The GPU is not used: WebP encoding (sharp/libvips) is CPU-only, and there are no local model weights.
- The harness containers get **no `DATABASE_URL`**. They reach the store only through its bearer-protected sync endpoints, so they can't read customer data (DPDP).
- The i3 is temporary: keep everything in Docker Compose, with nothing tied to this hardware.

## People and channels

Discord server, three channels:
- `#approvals`: held prices, new-item actions, token reminders (approval bot on the i3, owner's user ID only);
- `#alerts`: canary, escalations, memory warnings (send-only webhooks);
- `#brain`: the owner talking to Claude on the Mac.

The approval bot and the `#brain` bridge are separate bot applications with separate tokens.
