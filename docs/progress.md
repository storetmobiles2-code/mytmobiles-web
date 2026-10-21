# Progress and handoff

**Last updated:** 21 October 2026. **No work in progress:** everything is committed. The only open items are the code gaps under "Next code work" below and the decisions and shop checks for the owner and staff.

In a new session, read this first, then `CLAUDE.md`, `.claude/skills/store-rules/SKILL.md` and `.claude/skills/store-dev/SKILL.md`. The code graph builds itself at session start (see "Code graph" in `CLAUDE.md`).

## What the store has

- **Storefront:**
  - search, filters, product pages with multi-view official galleries and a 360° viewer;
  - cart and checkout (COD and Razorpay), pincode delivery estimates;
  - accounts and GST invoices.
- **Product pages** show warranty, country of origin and manufacturer/importer, as Legal Metrology requires.
- **Grievances** (Consumer Protection (E-Commerce) Rules, 2020):
  - grievance officer details on Contact, Terms and the footer;
  - complaint tickets `GRV-YYYY-NNNNNN` with tracking;
  - Admin → Grievances with 48-hour and one-month overdue flags.
- **Admin:**
  - orders, inventory and stock-sheet import, products, photos and 360° uploads, banners, coupons, settings and analytics;
  - Admin → Reports → GST (GSTR-1) export.
- **Access control:**
  - **Two-factor sign-in (TOTP)** for everyone who can open `/admin`, with recovery codes and `npm run auth:reset-2fa` (production-guide §6.1);
  - **Staff roles:** owner and staff, with permissions on every admin page and action;
  - **Activity log** of every admin change.
- **Catalogue:**
  - 47 product files with official manufacturer, origin, MRP and content (27 `live`, 20 `draft`);
  - the toolchain (`npm run catalog`, `npm run ops`) and seven maintenance agents (`.claude/agents/`).
- **Static demo:** https://storetmobiles2-code.github.io/mytmobiles-web/, rebuilt on 21 October 2026 with all of the above applied to its data.

## Next code work

These are the remaining gaps from `docs/production-guide.md` §9:

1. Error tracking (Sentry or similar), and logs kept 180 days or more (CERT-In).
2. Shiprocket courier integration: labels, pickups and tracking import.
3. DPDP: customer data export and account deletion (obligations start 13 May 2027).
4. GST credit notes for returns and refunds (GSTR-1 Table 9B).

## Waiting on the owner or staff

**Prices that need fixing in the POS:**
- **vivo Y31 5G demo unit:** priced ₹25,999, but vivo's MRP for the 4 GB + 128 GB model is ₹19,999. **Selling above MRP isn't allowed.** Check the box and fix the POS price.
- **Xiaomi X Series 43 demo unit:** priced ₹37,119, but Xiaomi sold the new TV at ₹23,999.

**Check MRPs against the boxes.** These are the brands' own listed MRPs for the exact variant, but they're much higher than the selling prices, so the store shows large discounts:
- vivo Y05 4+64: ₹34,999 (vivo's page: "MRP (incl. of all taxes)"), selling at ₹12,999;
- vivo Y11 4+64: ₹39,999;
- Galaxy A06 6/128: ₹25,999;
- Galaxy A07 4/128: ₹31,999;
- Galaxy A07 6/128: ₹34,999;
- Tab A11 LTE demo: ₹29,999;
- Tab A11+ 5G: ₹47,999;
- iPhone 17: kept at ₹82,900 (Apple's current price is ₹99,900, but older boxes may say ₹82,900).

**Read the box in the shop.** The full lists are in `docs/handoff/catalog-*-report.md`.
- **Manufacturer, origin and MRP:**
  - Crompton Supremus 70L, Kenstar Doublecool DX 60L, Voltas Grand 52E, TCL S5500 32";
  - Orient Ultimo 88L (also warranty);
  - iPhone 15, iPad 9th gen and AirPods 4 (Apple no longer publishes these), OPPO A58 and Reno 10, Philips S7221, Fastrack Revolt FS1.
- **The role printed on the label** ("Manufactured by" or "Imported by"): Galaxy S26 and S26 Ultra.
- **Exact model:**
  - Xiaomi A Series 32 (2023, 2024 or 2025 edition);
  - Cellecor 43" Full HD (E-43P?);
  - Samsung Crystal 4K Vivid 43" (UA43DUE76AKLXL?).
- **Real manufacturer and importer for all Xiaomi TVs.** Xiaomi only says "as set out on the MRP label".
- **Other checks:**
  - Orient Tornado colour: "Dark Grey" or "Black";
  - AirPods 4: ANC model or not;
  - vivo colour names;
  - X Series 43: "Android TV" or Google TV;
  - Galaxy A37 "Awesome White": this colour doesn't exist in India, so the stock sheet may be mis-keyed.
- **Photos:** 10 products have no official photo. Photograph them in the shop and upload in Admin with the credit "Photographed in store".

When staff confirm a value, update the product file (catalog-editor agent), set it to `live` once validation passes, and merge.

**Decisions for the owner:**
- **Grievances:**
  - Does the automatic receipt email count as the 48-hour acknowledgement? Currently it doesn't; the first staff update does.
  - "One month" is currently the earlier of one calendar month or 30 days.
  - Recheck the wording against the official Rules PDF.
- **GST:** have a CA confirm:
  - B2CS type "OE";
  - whether to issue credit notes;
  - whether the offline tool accepts the UTF-8 BOM;
  - the hsn.csv column order.
- **Staff:** should staff see customer details and History panels (owner-only now), and should the packing slip show the COD amount?
- **Smartwatches:** the POS has only one (Fastrack Revolt FS1). Add more to the POS, or send a list to onboard.
- **Launch:**
  - GSTIN, Razorpay KYC, domain, hosting and database (production-guide §2);
  - set `TOTP_ENCRYPTION_KEY` in production and keep a copy;
  - enable the catalogue workflow with repository variables when ready.

## Verification (21 October 2026)

- **Locally:** lint, typecheck, 168 unit tests, the production build and `catalog validate` (47 files) pass.
- **e2e (Playwright, fresh seeded database):** 51 of 51 passed on desktop and mobile with two-factor enforced. The storefront and accessibility suites (33) were re-run after the product-page legal-details change.
