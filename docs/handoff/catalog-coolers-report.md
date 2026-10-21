# Coolers: legal details, MRP and content

Research was done on 2026-10-15, and `retrievedAt` is 2026-10-15 on every source. All 10 files were created with `npm run catalog -- export <slug>`. They are uncommitted, in `/home/user/mytmobiles-web/catalog/products/`.

- **Legal pass** changed `manufacturerInfo`, `countryOfOrigin`, variant `mrp` and `sources`.
- **Content pass** changed `shortDescription`, `description`, `highlights`, `specs`, `boxContents`, `warranty`, `keywords` and `status`. It also fixed JetMax 70T's single-letter keyword "t".
- Nothing else changed: no price, stock, variants (other than MRP), images, stock-sheet names, HSN or GST.

`npm run catalog -- validate` gives **0 errors across all 10 slugs**. The `catalog apply` dry run shows only the fields above for each slug.

| slug | status | manufacturerInfo (short) | origin | MRP (before → after) | price | Content | source |
|---|---|---|---|---|---|---|---|
| crompton-marvel-neo-40-l-air-cooler | live | Crompton Greaves Consumer Electricals Ltd, Vikhroli, Mumbai ("Manufacturer contact information") | India | ₹7,499 → ₹9,500 (ACGC-MARVELNEO40) | ₹7,499 | ✓ | https://www.crompton.co.in/products/crompton-marvel-neo?variant=46667000054064 |
| crompton-zelus-dac43-air-cooler | live | same as Marvel Neo | India | ₹8,499 → ₹9,500 (ACGC-ZELUSDAC43) | ₹8,499 | ✓ | https://www.crompton.co.in/products/crompton-zelus-dac?variant=46666860986672 |
| orient-electric-tornado-52-l-air-cooler | live | Mfd by The Supreme Industries Ltd, Noida; Packed & Marketed by Orient Electric Pvt Ltd | India | ₹10,999 → ₹15,490 (CD5202H) | ₹10,999 | ✓ | https://orientelectric.com/products/tornado-desert-air-cooler?variant=44213137047714 |
| orient-electric-tornado-88-l-air-cooler | live | same as Tornado 52 L | India | ₹12,499 → ₹18,490 (CD8804H) | ₹12,499 | ✓ | https://orientelectric.com/products/tornado-desert-air-cooler?variant=44213137113250 |
| voltas-jetmax-70t-air-cooler | live | Voltas Ltd, Voltas House 'A', Chinchpokli, Mumbai ("Manufacturers / Importers") | India | ₹13,499 → ₹19,790 (4810352) | ₹13,499 | ✓ (specs from Voltas catalogue, warranty from Voltas warranty page) | https://www.voltas.com/products/voltas-desert-air-cooler-jetmax-70t |
| voltas-grand-72-desert-air-cooler | draft | same as JetMax 70T | India | ₹12,499 → ₹18,190 (4810331) | ₹12,499 | ✓ text; no photo | https://www.voltas.com/products/4810085-voltas-air-cooler-grand-72 |
| orient-electric-ultimo-88-l-air-cooler | draft | — (not on official page) | — | ₹13,499 → ₹19,990 (CD8803H) | ₹13,499 | ✓ text; missing warranty, box contents, dimensions | https://orientelectric.com/products/ultimo-desert-air-cooler?variant=45370974765218 |
| voltas-grand-52e-desert-air-cooler | draft | — | — | ₹12,499 unchanged | ₹12,499 | ✓ text from Voltas catalogue; no photo, MRP or legal | Voltas Air Cooler 2024 Catalogue (below) |
| crompton-supremus-70-l-desert-air-cooler | draft | — | — | ₹11,999 unchanged | ₹11,999 | ✗ import text kept (no official source) | none |
| kenstar-doublecool-dx-60-l-air-cooler | draft | — | — | ₹8,990 unchanged | ₹8,990 | ✗ import text kept (discontinued, no official source) | none |

Other official sources:
- **Voltas Air Cooler 2024 Catalogue:** https://cdn.shopify.com/s/files/1/0578/6845/2026/files/Air_Cooler_2024_Catalogue.pdf?v=1719985289
  - It is linked as "View Product Catalogue" from the voltas.com product pages.
  - Its tech-spec tables (pp. 12 and 14) cover the Grand 52/72/92 (SAP codes 4810329/331/333), the Grand 52E/72E/92E (4810330/332/334) and the JetMax 70T (4810352).
  - It says specs may change without notice.
- **Voltas warranty page:** https://www.voltas.com/pages/terms-conditions-product-warranty. It states "Air Coolers - 1 Year Warranty on all Air Coolers".

## Draft because…
For an existing product, `draft` leaves visibility as it is: these products stay live in the store exactly as now. After merge, the apply step still updates their content and MRP.

- **voltas-grand-72-desert-air-cooler:** it has no pipeline photo, so it can't pass as live. All other fields are complete. An earlier image check found that the official Grand 72 photos are identical to the Grand 52's.
- **orient-electric-ultimo-88-l-air-cooler:**
  - No manufacturer or country of origin: the official page has no legal block.
  - No warranty: not stated on the page.
- **voltas-grand-52e-desert-air-cooler:**
  - No photo.
  - No MRP: the catalogue has no prices, and voltas.com sells only the Grand 52.
  - No manufacturer or country of origin.
  - Specs, description and warranty are now filled from Voltas's official catalogue and warranty page.
- **crompton-supremus-70-l-desert-air-cooler:** there is no official page at all, so the text was left as imported. It is also missing a photo, manufacturer, origin and MRP.
- **kenstar-doublecool-dx-60-l-air-cooler:** the model is discontinued and kenstar.in doesn't list it. The text was left as imported, and it is also missing a photo, manufacturer, origin and MRP.

## Needs staff (read the box)
- **crompton-supremus-70-l:** MRP, manufacturer name and address, country of origin and warranty. Retailers give model ACGC-SUPREMUS70, but none of them were used.
- **kenstar-doublecool-dx-60-l:** MRP, manufacturer, origin and warranty. The stock-sheet name "Doublecool DX WW 60L" suggests the wood-wool pad version.
- **voltas-grand-52e:** MRP, manufacturer and origin. Don't copy the Grand 52's MRP (₹14,490): it is a different model.
- **orient-electric-ultimo-88-l:** manufacturer and origin, and the warranty from the warranty card. Also confirm the box says CD8803H. Orient uses contract manufacturers, so don't copy the Tornado's details.
- **Orient Tornado 52 L and 88 L, colour:** our variant colour is "Dark Grey", but Orient's spec table says "Black". Please confirm the colour and the model code (CD5202H, CD8804H) on the box. I left the colour out of the new spec table so it doesn't contradict the variant.
- **Orient Tornado 52 L and 88 L, marketer:** the page names "Orient Electric Pvt Ltd" with no address. The company's registered name is Orient Electric Limited. If the box has the full name and address, it wins.
- **Crompton Marvel Neo and Zelus:**
  - The page labels the address "Manufacturer Contact Information". If the box names a contract manufacturer, use that.
  - The Zelus page title says "Zelus PAC", but the variant SKU ACGC-ZELUSDAC43 matches our DAC43.
  - Crompton's site says its prices are "for reference purpose only".
- **Voltas Grand 72 and JetMax 70T:** the specs come from the 2024 catalogue, which is the one the product page links to. Check that they match the box/manual of the units in stock.
