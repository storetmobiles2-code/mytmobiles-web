# Progress and handoff

**Last updated:** 31 October 2026. Accessories (#6), the POS stock sync (#7) and the CI runner pin (#8) are merged. **In review:** the product-photo quality review (branch `feat/image-quality`, see "Product photos" below). Other open items are the code gaps under "Next code work" and the decisions and shop checks for the owner and staff.

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
  - 58 product files with official manufacturer, origin, MRP and content (32 `live`, 26 `draft`);
  - an **Accessories** section (see below) fed by the second myBillBook company, "T MOBILES";
  - the toolchain (`npm run catalog`, `npm run ops`) and seven maintenance agents (`.claude/agents/`).
- **Static demo:** https://storetmobiles2-code.github.io/mytmobiles-web/, rebuilt on 21 October 2026 with all of the above applied to its data.

## Accessories (T MOBILES company), 31 October 2026

The owner's myBillBook login has two companies. The second, "T MOBILES", holds 198 items (114 in stock): accessories, audio, smartwatches and keypad phones. Its export is `catalog/stock-sheet-accessories.csv`.

**What the code does:**
- The stock-sheet parser knows accessory kinds, read from the myBillBook category first and the item name second. It also knows the brands and their POS spellings (FIREBOLT/FIREBOLTT, ZEBRINICS, GOBOULT, ONPLUS, MI…). Matching keys (`normaliseSheetName`) are unchanged.
- **Categories:**
  - an **Accessories** parent with eight sub-categories: Chargers & Adapters, Cables, Power Banks, Speakers & Soundbars, Smart Home, Security Cameras, Trimmers, Keyboards & Mice;
  - **Keypad Phones** under Mobiles;
  - AirPods, headphones and Nord Buds go to Audio, and smartwatches to Smartwatches (both stay top-level).
- **Storefront:**
  - Accessories appears in the nav and home page, and has its own home-page rail;
  - parent category pages get sub-category links and a **Type** filter (also in the static demo);
  - the 5G filter shows only where there are 5G products.
- **Seed:** a new database is seeded from both sheets. Items claimed by a product file under another slug are left for `catalog apply`.
- **Price safety:** a ₹0 price on the sheet never makes a product live.

**Classified by name** (empty or brand-only category):

| Item | Decision |
|---|---|
| Fire-Boltt Encore Stainless Steel BT calling Smart Watch | Smartwatches |
| fire bolt ninja call | Smartwatches (Fire-Boltt makes only watches in this POS) |
| NOISE TWO HEADPHONES, ONEPLUS NORD BUDS 3r | Audio |
| PHILIPS E2101C BLACK, PHILIPS E2102 BLACK (category "PHILIPS") | Keypad Phones |
| XIAOMI 67W SONIC CHARGE 3.0 CHARGER COMBO | Chargers & Adapters |
| XIAOMI 6A HYPER CHARE CABLE, XIAOMI SONIC CHARGE TYPE-C CABLE | Cables |

**Product files so far (11):**
- `live` (5): Apple 20W USB-C Power Adapter, Apple 60W USB-C Charge Cable (1 m), Apple EarPods (USB-C), Samsung 45W USB-C Power Adapter, Samsung 65W Power Adapter Trio.
- `draft` (6), each waiting on staff:
  - Apple USB-C to Lightning Cable: confirm it's the 1 m cable (₹2,190 MRP; the 2 m is ₹3,500).
  - Samsung 25W USB-C Power Adapter (without cable): which colour, white (EP-T2510NWNG) or black (EP-T2510NBNG)? Then add that colour's official photos.
  - Samsung 25W with USB-C cable: colour, and the MRP from the box. Samsung India shows no price; the file uses the POS price (₹2,099) so no discount is shown.
  - Samsung 45W with cable: model code, MRP, manufacturer and country of origin from the box. There's no Samsung India page for it.
  - Samsung Type-C Earphones (EO-IC100): colour, black or white.
  - Samsung USB-C to USB-C cable: confirm EP-DA705 (3A, 1 m), and read the manufacturer and country of origin off the box. Samsung's page says only "as mentioned on the product".

**Still to onboard (103 in-stock items).** Use the product-onboarder, one family at a time, with these exact POS names:
- **Audio (23):** OnePlus Bullets Wireless Z3 (15); boAt AIRDOPES 141 OR 148 (12); PEBBLE FLEX LITE WIRELESS NECKBAND (10); Pebble BlissBuds Ace (8); boAt AIRDOPES 148 GEN 2 (8); itel Wireless Neckband N53F (8); boAt AIRDOPES 213 OR 212 (6); BOAT AIRDOPES PRIME 412 (5); REALME BUDS CLASSIC TYPE-C (5); ONEPLUS NORD BUDS 3r (4); boAt AIRDOPES 441 (4); boAt ROCKERZ 255R (4); JBL Wave Beam (3); NOISE TWO HEADPHONES (3); SHKOD AirLits Max (3); boAt Immortal 141 (3); REDMI BUDS 6 (2); JBL Tune 310C (1); ZEBRINICS SILENCIO 200T (1); ZEBRONICS THUNDER MAX (1); boAt Airdopes 170 ANC (1); boAt Rockerz 235v2 (1); boAt Rockerz Plus 550 (1).
- **Smartwatches (21):** PEBBLE TRIO SPECIAL EDITION (6); PEBBLE COSMOS VOGUE (5); Pebble Vienna (5); HAMMER FIT PRO (3); FIREBOLT GLADIATOR PLUS (2); Fire-Boltt Astra (2); Fire-Boltt Ninja Call Pro Max (2); TAGG VERVE NEO (2); one each of FIREBOLT EMPEROR, ORION, PHONEX, SUPERNOVA, TOPAZ LUXE; Fire-Boltt Clickk, Diablo, Encore, Royale, Snapp, Talk, Xelor; PEBBLE RISE PRO.
- **Keypad Phones (16):** Philips E2101C (Black, Orange), E2102 (Black, Cool Gray), E2103 (Light Green, Orange), E2104 (Black, Crystal Blue), E2112 (Orange, Sky Blue), E2112S (Cool Gray, Crystal Blue, Light Green); HMD 150 MUSIC; LAVA A3; LAVA A3 KING (1 each).
- **Speakers & Soundbars (15):** BOAT AAVANTE BAR 950 (5); JBL CINEMA SB241 (3); ZEBRONICS Juke BAR 7400 PRO (3); Boult Bassbox X120 (2); ZEBRONICS ZEB VITA PRO (2); ZEBRONICS ZEB-FEEL 4 (2); boAt Stone 1010 (2); one each of BLAUPUNKT SBA, INTEX 4.1, ZEBRONICS Zeb-Juke BAR 9500WS PRO, boAt AAVANTE BAR 2000, boAt Aavante Bar Azure Pro, boAt Stone 350 Pro, Stone 500, Stone Symphony.
- **Chargers & Adapters (10):** VIVO FLASH CHARGE 90W (5); MOTOROLA TURBO POWER 68 (4); OnePlus SUPERVOOC 100W (4); GM G+ 3-in-1 Wireless Charger (3); Nothing 33W (3); CMF NOTHING 65W GAN (2); REALME SUPERVOOC 80W (2); XIAOMI 45W TURBO, XIAOMI SONIC CHARGE 2.0 33W, XIAOMI 67W COMBO (1 each; the 67W has a ₹0 price in the POS).
- **Cables (8):** REALME USB-A TO TYPE-C SUPERVOOC (9); Google USB-C to USB-C (7); OPPO USB-A TO TYPE-C (7); VIVO TYPE-C (5); Nothing USB Type C TO C (4); OnePlus USB-A to Type-C 10A (2); XIAOMI SONIC CHARGE TYPE-C (2); XIAOMI 6A HYPER CHARE (1).
- **Power Banks (7):** XIAOMI POWER BANK 4i 20000mAh 33W (6); GIZMORE SLICK 10000mAh (4); Stuffcool Major 10000mAh (4); REDMI POWER BANK "2000 mAh" (2); XIAOMI POCKET POWER BANK 10000 (1); XIAOMI POWER BANK 4i 10000mAh (1); XIAOMI POWER BANK 5i 20000 67W (1).
- **Smart Home, Trimmers, Keyboards (3):** ECHO DOT 4th GEN (2); PHILIPS BEARD TRIMMER SERIES 3000 (1); PEBBLE DIGIT002 keyboard and mouse combo (1).

Brand stores (boAt, Fire-Boltt, Pebble, Noise and others) often lack the legal block. Those products stay `draft` until staff read the manufacturer or importer, the country of origin and the MRP off the box.

## Product photos: quality review (31 October 2026)

All 401 gallery images were reviewed against the new quality bar (store-rules → Photos → Quality bar). **75 were rejected**: clipped composite close-ups (the iPhone 17 "angle" shots), phones on lettering banners and backdrop panels, multi-panel collages, text-heavy marketing panels (most cooler galleries), tiny-product scenes and soft enlargements. Each one is listed with its reason in `catalog/images.rejected.json`, and the image builds refuse them.

- `npm run images:audit` re-checks every image and writes labelled contact sheets to `.cache/sheets/audit/`.
- The build now keeps an image's previous version when the brand's server is down. Philips' image server returned HTTP 500 for the S7221 photos on 31 October.

**Photograph in the shop** (no official image meets the bar). Upload in Admin → Products, credit "Photographed in store":
- **Redmi Pad 2 Pro 5G** (Graphite Gray, Quick Silver): Xiaomi India shows only promo panels, and the global site's clean shot is the Wi-Fi model.
- **vivo Y11 5G demo unit** (Midnight Blue): vivo's only image was a dark banner. Its product file is now `draft`, so it stays on sale with "Photo coming soon".
- **OnePlus 65U1S TV:** a front view. Only two room shots remain.

**Galleries now down to one image per colour** (more official views wanted):
- iPhone 17, all colours: Apple's other views are clipped or soft.
- Crompton Marvel Neo 40L, Crompton Zelus DAC43, Orient Tornado 52L and 88L, Orient Ultimo 88L: the rest were marketing panels.
- Galaxy A27 (Black, Light Pink), A37 (Awesome Charcoal) and A57 (Awesome Lilac): one group shot each.

## 360° views

The viewer is built and works on the live site and on the GitHub Pages demo; both were checked locally on 31 October with a test sequence. **No product has a spin yet**, because the house rules accept only a real frame sequence:
- **Brand frame sets:** none found for the models we stock. Samsung's "360° colours viewer" is an interactive 3D model, Apple and vivo publish none, and Xiaomi and OPPO pages have only stills. The rules don't allow turning a 3D model or video into a spin.
- **In the shop** (the practical route):
  1. Put the unit on a turntable against a plain white background, with the camera fixed and the lighting even.
  2. Take 24–36 photos at equal steps for one full turn.
  3. Upload them in Admin → Products → "360° view", choosing the colour, with credit "Photographed in store".

  Start with the best-selling phones in stock.

## Next code work

These are the remaining gaps from `docs/production-guide.md` §9:

1. Error tracking (Sentry or similar), and logs kept 180 days or more (CERT-In).
2. Shiprocket courier integration: labels, pickups and tracking import.
3. DPDP: customer data export and account deletion (obligations start 13 May 2027).
4. GST credit notes for returns and refunds (GSTR-1 Table 9B).

## Waiting on the owner or staff

**Fix in the T MOBILES company (myBillBook):**
- **Selling price ₹0:** "fire bolt ninja call" and "XIAOMI 67W SONIC CHARGE 3.0 CHARGER COMBO" (1 in stock). The store never publishes a ₹0 price.
- **Duplicate item:** "INTEX 4.1 MULTIMEDIA SPEAKER" exists twice (₹3,499 with 1 in stock; ₹4,000 with 0). Merge them into one.
- **Typos in item names:** "ZEBRINICS" (ZEBRONICS), "ONPLUS" (ONEPLUS), "HYPER CHARE" (HYPER CHARGE), "BLUTOOTH", "COOL GRY", "12OW" (120W). The store reads these correctly. After renaming in the POS, ask for the product file's `stockSheetNames` to be updated in the same week.
- **"REDMI POWER BANK 2000 mAh 18W":** this is probably the 20000 mAh model. Check the box.
- **In both companies:** "FASTRACK REVOLT FS1 BT CALLING SMART WATCH", priced ₹2,999 (4 in stock) in the phones company and ₹2,499 (0 in stock) in T MOBILES. Keep it in one company, or at least keep one price.
- **Check box MRPs against the POS price:** Apple's current MRP is ₹2,190 for the 20W adapter and the EarPods (USB-C), sold at ₹1,999. Older boxes printed ₹1,900, which would put ₹1,999 **above MRP**, so check the printed MRP on stock in hand.

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
- **Accessories: have a CA confirm the HSN codes and GST rates** before these products are invoiced. They are proposals in `KIND_META` (`src/lib/catalog/build-catalog.ts`):

  | Category | Proposed HSN | GST |
  |---|---|---|
  | Keypad Phones | 85171400 | 18% |
  | Chargers & Adapters | 85044030 | 18% |
  | Cables | 85444299 | 18% |
  | Power Banks | 85076000 | 18% |
  | Speakers & Soundbars | 85182200 | 18% |
  | Smart Home (Echo Dot; Fire TV Stick may need 85287100) | 85176290 | 18% |
  | Security Cameras | 85258900 | 18% |
  | Trimmers | 85102000 | 18% |
  | Keyboards & Mice | 84716060 | 18% |
- **Keypad phones:** placed under Mobiles → Keypad Phones, not under Accessories. Confirm that's how the shop wants them shown.
- **Audio and Smartwatches** stay top-level categories next to Accessories. They could instead become sub-categories of Accessories.
- **Launch:**
  - GSTIN, Razorpay KYC, domain, hosting and database (production-guide §2);
  - set `TOTP_ENCRYPTION_KEY` in production and keep a copy;
  - enable the catalogue workflow with repository variables when ready.

## Verification (31 October 2026, branch `feat/accessories`)

- **Locally:** lint, typecheck, 176 unit tests, the production build and `catalog validate` (58 files) pass.
- **e2e (Playwright, freshly seeded database, then build):** 56 of 56 passed on desktop and mobile. This includes the new accessories tests (home page link, sub-category links, Type and Brand filters, no sideways scroll at 390 px) and axe WCAG 2.1 AA on `/c/accessories`. The run used the installed Google Chrome, because this Mac doesn't have the Chromium build this Playwright version expects.
- **Static demo:** built (232 pages) from a fresh seed with the 11 accessory files applied. `/c/accessories` filters by type in the browser with no errors.

## Verification (21 October 2026)

- **Locally:** lint, typecheck, 168 unit tests, the production build and `catalog validate` (47 files) pass.
- **e2e (Playwright, fresh seeded database):** 51 of 51 passed on desktop and mobile with two-factor enforced. The storefront and accessibility suites (33) were re-run after the product-page legal-details change.
