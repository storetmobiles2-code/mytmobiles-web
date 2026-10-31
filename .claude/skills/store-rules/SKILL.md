---
name: store-rules
description: myT Mobiles house rules for any catalogue, content, pricing, image, operations or release work on this store — data ownership, official-image sourcing, Indian legal disclosures, copy style and production safety. Load before changing products, prices, photos or anything customers see.
---

# myT Mobiles — house rules

myT Mobiles is a mobile and electronics shop in India selling its own stock (an "inventory e-commerce entity" under the Consumer Protection (E-Commerce) Rules, 2020). Prices include GST. Every order gets a GST invoice.

## Who owns which data

| Data | Source of truth | How it changes |
|---|---|---|
| Selling price, stock | POS stock sheet (CSV export) | Admin → Inventory → Import stock CSV. Preview first with `npm run catalog -- stock-plan <csv>` |
| MRP | Brand's official India store/listing, or the box | `catalog/products/<slug>.json` → PR |
| Name, description, specs, highlights, box contents, warranty | Brand's official India product page | product file → PR |
| Manufacturer/importer, country of origin | Box label or official page | product file → PR |
| Photos | Brand's official site/press kit (or authorised distributor) | product file `images[]` → `catalog images` → PR |
| HSN code, GST rate | Accountant | product file → PR |
| Banners, coupons, store settings | Owner/staff | Admin panel |

When sources disagree, the **box label in the shop wins** for MRP, manufacturer/importer and country of origin. Next is the brand's page for that exact SKU, then other official pages. Record the conflict in the PR, and ask staff to read the box.

Never set a selling price above MRP, and never invent an MRP. If the official MRP can't be found, use the box MRP from the shop (ask staff), or leave MRP equal to the price so no discount is claimed. Record where it came from in `sources`.

## Photos

**Every colour gets a full gallery**, as on any large store: front, back, both sides and angled views, plus official detail shots (ports, camera, control panel), in that order. Aim for 4–8 images per colour, each labelled with its `view`:

| `view` | Shows |
|---|---|
| `front` | the front |
| `back` | the back |
| `front-back` | both, in one image |
| `side` | a side |
| `angle` | an angled view |
| `detail` | a close-up |
| `lifestyle` | the product in use |
| `box` | box contents |

Add a **360° spin** (`spins`) only when the brand publishes an official frame sequence for that exact model and colour (12+ frames, usually 24–72), or when staff photograph the unit on a turntable in the shop (uploaded in Admin → Products → 360° view). Never build a "spin" from a handful of photos.

The hero (first image) should show the single device. If the brand's only clean image is a composite of several devices of the same model and colour, use it, and say so in the PR.

- Use only the manufacturer's official India site, its global site for the same model, its press/media kit, or an authorised distributor that clearly permits reuse.
- **Never** use Amazon, Flipkart, Croma, Reliance Digital, Vijay Sales, Tata CLiQ, marketplaces, review sites (GSMArena, 91mobiles, Smartprix…) or Google Images results. `catalog validate` rejects known retailer domains, but the rule applies to any site.
- The photo must show the **exact** model, generation, colour and variant. When pages disagree (e.g. two models share colour names), use no photo.
- Don't remove watermarks or crop out logos. The pipeline only pads, trims whitespace and resizes.
- After `npm run catalog -- images <slug>`, open `.cache/sheets/catalog-<slug>.png` with the Read tool and check every tile: model, camera layout, colour, labels and the quality bar below. If anything is doubtful, remove that image.
- Record `credit` (e.g. "© Samsung Electronics") and `license`, e.g. "Official manufacturer product image © <Brand>, from the brand's official India website. Used unmodified (resized/padded only) for product identification by a retailer."
- A clearly labelled "Photo coming soon" placeholder is better than a wrong or unlicensed photo.

### Quality bar

An official image can still be wrong for the gallery. Reject it when it is:
- **clipped:** the product is cut off by the edge of the picture, or ends in a straight line inside it (a composite close-up of two phones cut at the bottom). Close-ups are fine only as a sharp, labelled `detail` after the full views.
- **a banner or backdrop panel:** the product on a coloured block, a lettering banner ("Blue", "Black") or a gradient panel, rather than cut out on white;
- **a collage:** several panels in one picture (a model plus mini detail shots);
- **a marketing panel:** headlines, feature icons or spec text laid over or around the product ("Beat the heat", "World's largest battery"), **including when it's rendered inside the phone's own screen** — a brand's hero shot that spells the model name across the display in large type ("Galaxy A37 5G") is a marketing graphic, not the device, and is rejected the same as a banner outside the product. A screen showing an actual home screen, app or a plain wallpaper (abstract colour/shape, no readable brand copy) is fine;
- **a scene where the product is small:** dark mood shots, room sets or sunsets in which the product is hard to see. A lifestyle image must show the product clearly;
- **soft:** enlarged from a small source (the audit flags sources under 700 px).

The first image of each colour must show the whole product: `front` or `front-back`, never a close-up or a scene. If the brand's only `front`/`front-back` image fails the marketing-panel check above, use the next full-product view (usually `back`) as the hero instead — don't drop the colour to a close-up or no hero at all.

How it is enforced:
- `npm run images:audit [filter]` checks every gallery image and writes labelled contact sheets to `.cache/sheets/audit/`. It flags crops, photo backgrounds and small sources automatically. **It cannot see marketing text rendered on a screen** (that's inside the product's own silhouette, not the white margin it measures) — read every sheet and check the screen content itself, not just the product's outline. Clipped close-ups, collages, on-screen text panels and text-heavy wallpapers all need eyes.
- Rejected images go in `catalog/images.rejected.json` with the reason. `npm run images:build` and `npm run catalog -- images` refuse them, and images with a photo background in a front, back, side or angle slot, so they can't come back with a later edit.
- When a product is left with no image that meets the bar, keep the placeholder and add it to the in-store photo list in `docs/progress.md`.
- To preview a proposed set before adding it: `npx tsx scripts/images-preview.ts <proposal.json>` writes labelled contact sheets to `.cache/sheets/preview/`.

### Where official galleries live

| Brand | Where to look |
|---|---|
| Samsung | Per-SKU pages (`samsung.com/in/smartphones/galaxy-…/<name>-<sku>ins/`) carry the spec list, MRP and legal block in plain HTML. Gallery images are `images.samsung.com/is/image/samsung/p6pim/in/<sku>/gallery/…` (not the `-thumb-` ones), about 8–10 per colour. Buy pages cover several models at once, so match images by model code. |
| Xiaomi/Redmi | mi.com/in buy pages. Image arrays are in the page JSON (`i0x.appmifile.com`). |
| Apple | apple.com/in store buy pages: `…-finish-select-…_AV1`, `_AV2`, … are the different views. |
| vivo | shop.vivo.com/in pages embed per-SKU `imageUrls`. vivo pages sometimes disagree on colour names, so match by exact model and colour or skip. |
| Appliance brands | (Crompton, Orient, Voltas, Kenstar) Their own stores (Shopify-based) list per-variant galleries. Pick only the images listed for the exact variant (capacity and model code). |
| OPPO, OnePlus, Philips | oppo.com/in (or oppo.com/en for models removed from India with the same model code and colours), oneplus.in overview pages, philips.co.in by part number (e.g. CTS7221BKA/94). OnePlus serves several pages from oddly named CMS folders, so check that the image is actually used on the model's own page. |

The brand's India pages often hold only one clean image per colour. Its other official regional stores (e.g. mi.com/de, /uk) may be used **only** when the model and the colour name match India exactly. Say so in `license`. A brand's interactive 3D model or "360° video" is not a frame sequence: don't turn it into a spin.

For JavaScript-rendered pages, use Playwright with Chromium at /opt/pw-browsers.

## Legal display requirements (India)

Before a product goes live it must show:
- manufacturer/packer/importer name and address (`manufacturerInfo`) and country of origin (`countryOfOrigin`), both required by the Legal Metrology (Packaged Commodities) Rules;
- MRP inclusive of all taxes, the price, and the warranty;
- the return/replacement window (`returnWindowDays`; the store default is 7 days for damaged, defective or wrong items).

Store-level details are set by the owner in Admin → Settings: legal name, address, GSTIN, customer care, grievance officer. Never write fake reviews, ratings or "only 1 left" claims that aren't true. Never call a product "genuine", "original" or "authorised" unless the shop is an authorised dealer for that brand.

## Catalogue research: legal details, MRP and content

For an existing product, start from `npm run catalog -- export <slug>`. Change only what you researched, and record every page in `sources` with `usedFor` and the date.

- **`manufacturerInfo`:** copy the brand's own legal block for that model exactly, keeping its labels ("Manufactured by: …; Imported by: …; Marketed by: …") and full addresses. Where to find it:
  - Samsung per-SKU pages and Apple product-information pages carry it.
  - Xiaomi only gives "Manufactured For: Xiaomi Technology India…" and says the maker is "as set out on the MRP label". Copy that wording and ask staff to read the box.
  - Appliance stores often say "Marketed by" only, so record what's given.
- **`countryOfOrigin`:** only from an official source for that model, never inferred from where the brand is based.
- **`mrp`:**
  - It must be the exact variant's MRP, not a "starting from" price.
  - If it's below the selling price, don't set it; flag it.
  - Demo and open-box units take the new product's MRP and legal details.
- **Content:** write it in your own words from the official spec page, without copying marketing paragraphs:
  - `shortDescription`: one sentence;
  - `description`: 2–4 sentences;
  - `highlights`: 3–6;
  - grouped `specs`;
  - `boxContents`;
  - `warranty`: the brand's India warranty statement, or empty plus a staff note, never "as per brand policy";
  - `keywords`: 4–10, no junk.

  `catalog validate` rejects text left over from the stock-sheet import in live files.
- **Discontinued models:** a global page or official press release for the same model code is fine for what it clearly states. Appliance brands' official PDF catalogues linked from their own site count as official.
- **When pages disagree or the exact model is uncertain**, leave the field and list it under "Needs staff (read the box)".
- **`status`:** set `live` only when `catalog validate <slug>` shows no errors. Otherwise set `draft`. For a product already in the store, `draft` means "this file doesn't change its visibility": it stays live exactly as now. `hidden` unpublishes it.
- **Photos:** products whose photos come from the family pipeline (`catalog/reference.json`) leave `images` out of the product file. Validation counts the pipeline photos, and `apply` leaves them alone.

## Copy style

Plain, factual Indian English. Short sentences. No hype or superlatives that aren't the brand's own verifiable claims ("best", "fastest"). Keep marketing names as the brand writes them ("Galaxy A57 5G", "REDMI Note 15"). Units: GB, mAh, Hz. Screen sizes: phones and tablets in inches with cm in brackets when the brand gives cm (e.g. "15.64 cm (6.2 inch)"), and TVs in both. Use ₹ with Indian digit grouping (₹1,29,999). Specs come only from official sources, never guessed.

## Tools

```bash
npm run catalog -- report                    # what's missing or wrong in the live catalogue
npm run catalog -- new|export <slug>         # create or export a product file
npm run catalog -- images <slug>             # build images + contact sheet
npm run catalog -- validate [slug]           # rules check (exit 1 on errors)
npm run catalog -- apply <slug>              # dry run diff; --write applies (production only via CI after merge)
npm run catalog -- stock-plan <csv>          # preview a stock-sheet import with anomaly warnings
npm run ops -- report                        # today's operations brief (read-only)
```

Local database: `DATABASE_URL` from `.env`. If Postgres is down locally: `service postgresql start`.

To see a product page locally:
1. Apply to the **local** DB.
2. Run `npm run build && npx next start -p 3300`. This writes only to the git-ignored `.next/`.
3. Open http://localhost:3300/p/<slug>.

Avoid `next dev`, because it rewrites AGENTS.md; if it does, run `git checkout AGENTS.md`.

## Safety

- Production data changes go through a pull request. Agents never run `apply --write` against production themselves; the `catalog-apply` workflow does it after a human merges.
- Never push to `main`, force-push someone else's branch, or merge your own PR.
- Never commit secrets (`.env`, API keys, DB URLs). Never print them in PRs or issues.
- Never change orders, refunds, payments or customer data. Agents report on them, and staff act in Admin.
- When unsure about anything legal, financial (MRP, GST, refunds) or about a photo, stop and ask in the PR or issue rather than guessing.
