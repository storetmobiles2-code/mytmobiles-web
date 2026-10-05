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

Never set a selling price above MRP, and never invent an MRP. If the official MRP can't be found, use the box MRP from the shop (ask staff), or leave MRP equal to the price so no discount is claimed. Record where it came from in `sources`.

## Photos

- Use only the manufacturer's official India site, its global site for the same model, its press/media kit, or an authorised distributor that clearly permits reuse.
- **Never** use Amazon, Flipkart, Croma, Reliance Digital, Vijay Sales, Tata CLiQ, marketplaces, review sites (GSMArena, 91mobiles, Smartprix…) or Google Images results. `catalog validate` rejects known retailer domains, but the rule applies to any site.
- The photo must show the **exact** model, generation, colour and variant. When pages disagree (e.g. two models share colour names), use no photo.
- Don't remove watermarks or crop out logos. The pipeline only pads, trims whitespace and resizes.
- After `npm run catalog -- images <slug>`, open `.cache/sheets/catalog-<slug>.png` with the Read tool and check every tile: model, camera layout, colour and labels. If anything is doubtful, remove that image.
- Record `credit` (e.g. "© Samsung Electronics") and `license`, e.g. "Official manufacturer product image © <Brand>, from the brand's official India website. Used unmodified (resized/padded only) for product identification by a retailer."
- A clearly labelled "Photo coming soon" placeholder is better than a wrong or unlicensed photo.

## Legal display requirements (India)

Before a product goes live it must show:
- manufacturer/packer/importer name and address (`manufacturerInfo`) and country of origin (`countryOfOrigin`), both required by the Legal Metrology (Packaged Commodities) Rules;
- MRP inclusive of all taxes, the price, and the warranty;
- the return/replacement window (`returnWindowDays`; the store default is 7 days for damaged, defective or wrong items).

Store-level details are set by the owner in Admin → Settings: legal name, address, GSTIN, customer care, grievance officer. Never write fake reviews, ratings or "only 1 left" claims that aren't true. Never call a product "genuine", "original" or "authorised" unless the shop is an authorised dealer for that brand.

## Copy style

Plain, factual Indian English. Short sentences. No hype or superlatives that aren't the brand's own verifiable claims ("best", "fastest"). Keep marketing names as the brand writes them ("Galaxy A57 5G", "REDMI Note 15"). Units: GB, mAh, inch and cm (TVs show both), ₹ with Indian digit grouping (₹1,29,999). Specs come only from official sources, never guessed.

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

## Safety

- Production data changes go through a pull request. Agents never run `apply --write` against production themselves; the `catalog-apply` workflow does it after a human merges.
- Never push to `main`, force-push someone else's branch, or merge your own PR.
- Never commit secrets (`.env`, API keys, DB URLs). Never print them in PRs or issues.
- Never change orders, refunds, payments or customer data. Agents report on them, and staff act in Admin.
- When unsure about anything legal, financial (MRP, GST, refunds) or about a photo, stop and ask in the PR or issue rather than guessing.
