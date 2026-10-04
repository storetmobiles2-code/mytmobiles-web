# myT Mobiles — online store

Storefront and admin panel for **myT Mobiles**: mobiles, tablets, TVs, air coolers and accessories, sold with GST invoices, Cash on Delivery and Razorpay online payments.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7 and PostgreSQL.

---

## What's included

**Shoppers**
- Home page with banners, deals, brand and category rails.
- Category and brand listings with filters (brand, price, RAM, storage, 5G, condition, in-stock) and sorting.
- Search with live suggestions.
- Product pages with colour and memory variants, gallery, specs, pincode delivery estimate and verified-purchase reviews.
- Open-box (demo unit) section.
- Cart for guests and signed-in users; the guest cart merges at sign-in.
- Coupons.
- Checkout with saved addresses (pincode auto-fills city and state), delivery charges, COD limits and fees, and per-line CGST/SGST or IGST.
- Payments: Cash on Delivery, and Razorpay (UPI, cards, net banking, wallets) once keys are set.
- Account: orders and tracking, cancellation, return requests, retrying a failed payment, addresses, profile, password, email verification and wishlist.
- Printable GST tax invoice, issued at dispatch with a Rule 46 serial number (`MYT/2627/000001`).
- Help pages: shipping, returns, payments, privacy and terms, plus SEO (metadata, JSON-LD, sitemap, robots, canonical URLs).

**Store staff** (`/admin`, ADMIN role only)
- Dashboard with revenue, an orders-to-pack/ship queue, low-stock alerts, a conversion funnel and a launch checklist.
- Orders: filter and search, pack, ship (courier and AWB), deliver, cancel, returns and refunds, internal or customer-visible notes.
- Products: create and edit, variants, prices, stock, images (upload with source and licence fields), publish or hide.
- Inventory: manual adjustments with an audit log, plus **stock-sheet CSV import** with a preview of every change.
- Coupons, banners, categories, customers, review moderation, analytics, and store settings (GSTIN, address, shipping and COD rules).

**Under the hood**
- Money is stored as integer paise and prices are GST-inclusive. Tax is split per line on the invoice (`src/lib/gst.ts`, `src/lib/pricing.ts`).
- Order placement is idempotent and reserves stock atomically (`stock >= qty` guarded updates).
- Unpaid online orders release their stock after the payment window (cron).
- Late Razorpay payments for expired orders are revived if stock allows, otherwise refunded automatically.
- Auth uses server-side sessions (httpOnly cookies, hashed tokens), scrypt password hashing, rate limits on login, sign-up, reset, cart, pincode and order placement, and timing-equalised login.
- Every Server Action validates input with Zod and checks auth.
- Security headers: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` and Permissions-Policy.
- Product, home and help pages are ISR-cached; admin edits revalidate them immediately.
- First-party, cookie-less analytics (`/admin/analytics`), with optional GA4.

---

## Quick start (local)

Requirements: Node.js 20.9+ (22 recommended) and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, CRON_SECRET
npm install                   # also runs `prisma generate`
npx prisma migrate deploy     # create tables
npx prisma db seed            # categories, settings, banners, admin, catalogue
npm run dev                   # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, open **/admin**, and change the password under Account → Profile.

The seed imports the catalogue from `catalog/stock-sheet.csv` **only into an empty database**. Re-running it never overwrites live stock.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (the build needs the database, see below) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests: GST, pricing, delivery, stock-sheet parsing |
| `npm run test:e2e` | Playwright end-to-end and accessibility tests (see **Testing**) |
| `npm run db:migrate` | Create a new migration in development |
| `npm run images:build` | Download, verify and optimise product images listed in `catalog/reference.json` |
| `npm run images:sync` | Apply `catalog/images.lock.json` to an existing database (dry run; add `-- --apply`) |

---

## Environment variables

See `.env.example` for the full list.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Needed at **build** time too. |
| `NEXT_PUBLIC_SITE_URL` | yes | Public URL, used in emails, sitemap and canonical URLs. Inlined at build. |
| `CRON_SECRET` | yes | Protects `/api/cron/*`. 32+ random characters. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first seed | The first admin account. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | for online payments | Online payment stays hidden at checkout until these are set; COD still works. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | for email | Without SMTP, development prints emails to the server log; production logs that they were **not** sent. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | no | GA4. First-party analytics work without it. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | multi-instance | Keep it stable across instances and deploys. |
| `DATABASE_POOL_SIZE` | no | Default 10. |

---

## Deploying

The production build **pre-renders pages from the database**, so `DATABASE_URL` must point to a reachable, migrated database during `next build`.

### Any Node host (Vercel, Render, Railway, a VM)

1. Create the database and run `npx prisma migrate deploy && npx prisma db seed` once.
2. Set the environment variables above, then build with `npm run build` and start with `npm start`.
3. **Cron:** call `GET /api/cron/expire-orders` with `Authorization: Bearer $CRON_SECRET` **every 5–10 minutes**. It releases stock held by abandoned online payments and prunes old sessions and carts.
   - Vercel Cron needs a Pro plan for that frequency; Hobby is daily-only.
   - Any external scheduler also works, e.g. cron-job.org, GitHub Actions or a system crontab.
4. **Razorpay:** in Dashboard → Webhooks, add `https://<your-site>/api/payments/razorpay/webhook` with the `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` and `refund.failed` events. Use the same secret as `RAZORPAY_WEBHOOK_SECRET`.
5. Point an uptime monitor at `GET /api/health`. It returns 503 if the database is unreachable.

### Docker

`Dockerfile` builds a standalone image: about 450 MB, runs as the non-root `node` user, and has a healthcheck. `docker-compose.yml` runs it with PostgreSQL:

```bash
cp .env.example .env              # fill in values; add POSTGRES_PASSWORD and BUILD_DATABASE_URL
docker compose up -d db
docker compose run --rm migrate   # migrations + first-time seed
docker compose build app          # pre-renders pages, so the db must be running
docker compose up -d app          # http://localhost:3000
```

`BUILD_DATABASE_URL` is the database as seen from the build, normally `postgresql://myt:<password>@localhost:5432/mytmobiles`. It is passed as a BuildKit secret and is not stored in the image.

The Prisma CLI in the `migrate` image logs an "OpenSSL version" warning. It is harmless: migrations and the seed run correctly.

### Scaling notes

- Uploaded images are stored in PostgreSQL (`MediaAsset`), so app containers are stateless.
- The ISR page cache is per instance. Running more than one instance needs a shared cache handler (see the Next.js docs on `cacheHandler`) or a CDN in front.

---

## Day-to-day operations

### Before launch: Admin → Settings
The dashboard lists what's missing:
- Registered legal name
- **GSTIN**
- Dispatch address and state (needed for the CGST/SGST vs IGST split)
- Support email and phone
- Shipping fee, free-shipping threshold, and COD rules

**Review the legal pages** (`/terms`, `/privacy`, `/help/*`) with your advisor before launch. They are sensible defaults, not legal advice.

### Stock and prices
The shop sheet (POS export) is the source of truth.

1. Export the stock sheet as CSV. The columns are Name, Selling Price, Stock Quantity and Item Category Name; column order doesn't matter.
2. In **Admin → Inventory → Import stock CSV**, upload it and review the preview (changed, unchanged, unmatched rows, new products), then apply.
   - Units sold online but not yet shipped are subtracted automatically, so they aren't sold twice.
   - Rows the store hasn't seen before can create new **hidden** products for you to complete before publishing.
3. Day to day: online orders reduce stock immediately. Once an order ships, bill it in the POS so the next sheet matches.

Products with zero stock stay hidden; restocked products can be re-published automatically during import. Of the 348 products in the supplied sheet, 60 are in stock and live.

### Orders
COD and paid orders arrive as **Confirmed**:
1. Pack.
2. Ship (enter courier and AWB). This issues the invoice number.
3. Deliver.

Customers can cancel before shipping and request returns within the product's return window. Prepaid refunds go through Razorpay automatically. COD refunds are paid by bank transfer, then marked refunded.

### GST
HSN codes and GST rates are set per product, using common defaults:
- Phones: 8517 13 00 at 18%
- TVs: 8528 at 18%
- Air coolers: 8479 at 18%
- Tablets: 8471 at 18%

**Confirm them with your accountant** and adjust them in Admin → Products.

---

## Product images and catalogue data

All images live in `public/images/products/`. Each one is listed with its **source URL, source page, credit and licence note** in `catalog/images.lock.json`, and is also stored on its `ProductImage` row, where admins can see it.

- **Sources:** official manufacturer India sites and stores only (mi.com, samsung.com/in, apple.com/in, oppo.com/in). Nothing comes from Amazon, Flipkart or other retailers, and nothing has been watermark-edited.
- **Verification:** every image was checked visually against the exact model, generation and colour using contact sheets (`npm run images:build -- --sheets`).
  - Where the official source didn't show the exact model or colour, no image was used.
  - Examples: vivo Y05/Y11/Y31 (the official pages disagree on which colours belong to which model), Galaxy A37 "Awesome White" (not listed on Samsung India), Pixel 11 Pro/XL.
- **Processing:** images are padded onto a white 1200×1200 canvas and saved as WebP. Next.js serves AVIF/WebP at responsive sizes, with lazy loading below the fold.
- **Placeholders:** products without a verified image show a clearly labelled "Photo coming soon" placeholder. That currently covers 25 live items: TVs (the stocked Xiaomi models are no longer on mi.com), air coolers, vivo, OPPO A58, Philips S7221, Fastrack Revolt FS1 and Cellecor. **Admin → Products → "Live without images"** lists them; upload images there with their source and licence.
- **Licensing:** manufacturer images are copyrighted by the brands. They are used unmodified to identify the products being sold, which is common retail practice. **Confirm reuse under each brand's authorised-reseller or brand-asset terms** before launch.
- **Adding images in bulk:** add the official URL to `catalog/reference.json`, run `npm run images:build -- --sheets`, check the sheet in `.cache/sheets/`, then run `npm run images:sync -- --apply`.
- **MRPs:** taken from the brands' official India stores on 4 Oct 2026, where listed. Otherwise MRP equals the selling price, so no discount is claimed.

---

## Testing

```bash
npm test                         # unit tests (Vitest)
npm run build && npm run test:e2e   # Playwright: starts `next start` on :3100
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # against a running server
```

The e2e suite covers:
- Storefront and SEO: titles, canonical URLs, JSON-LD, sitemap, robots, real 404s
- Security headers
- Search and filters
- Variant deep links
- The **full purchase path**: guest cart → sign-up (cart merge) → address with pincode lookup → Cash on Delivery → confirmation → admin packs, ships and delivers → GST invoice
- Every admin page
- axe-core **WCAG 2.1 AA** checks on the main pages

It runs on desktop and on a Pixel 7 viewport. It fails on any browser console error.

> The e2e tests place real orders and clear rate limits. **Run them only against a disposable database.**

Lighthouse (mobile, production build, local): home, product and category pages score 89–98 performance and 100 for accessibility, best practices and SEO. Product-page CLS is 0.

---

## Project layout

```
catalog/            stock sheet, verified reference data (images, MRPs), overrides, image lock file
prisma/             schema, migrations, seed
scripts/            image pipeline, image sync, brand asset generation
src/app/(store)/    storefront routes        src/app/admin/   admin panel
src/app/api/        health, session, search, pincode, events, Razorpay webhook, cron
src/app/actions/    customer Server Actions  src/lib/         domain logic (orders, pricing, GST, delivery, catalog, auth)
src/components/     UI                       tests/           unit + e2e
```

## Not yet verified in this environment

- **Razorpay** test-mode payments, webhooks and refunds: the integration is complete, but no keys were available.
- **SMTP** delivery: emails are rendered, and printed to the log in development.

Test both with real keys before launch.
