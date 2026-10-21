# TVs: legal, MRP and content report

Group: `tvs` (7 slugs). Sources retrieved 2026-10-15. `catalog validate` gives 0 errors on all 7. `catalog apply` was run as a dry run on each one, and every diff shows only the intended fields: manufacturerInfo, countryOfOrigin, variant mrp, keywords, and the content fields on the 3 Xiaomi products that stay live. `status` was also changed in 4 files, and that is not a database change: `draft` leaves visibility as it is, so it does not show in the diff.

Xiaomi legal text is copied word for word from Xiaomi India's buy-page data (`mrp_info` in `https://in-go.buy.mi.com/in/v2/item/productdetail?from=pc&tag=<page>`, the same data shown on the buy page). It is the same for every Xiaomi TV:
"Manufactured For: Xiaomi Technology India Private Limited, Building Orchid, Block E, Embassy Tech Village, Marathahalli-Sarjapur Outer Ring Road, Devarabisanahalli, Bengaluru, Karnataka-560103; Manufactured By: As set out on the MRP label of the Product; Imported By: As set out on the MRP label of the Product"

| slug | manufacturerInfo (short) | countryOfOrigin | MRP | status | Content | source |
|---|---|---|---|---|---|---|
| xiaomi-a-pro-80-cm-32-inch-magiqled-google-tv | Mfd for Xiaomi Technology India Pvt Ltd (Bengaluru); mfd by: as on MRP label | India | ₹14,999 → ₹26,999 | live | ✓ (box contents left empty, see below) | https://www.mi.com/in/product/xiaomi-a-pro-qled-tv-32/buy/ (plus /specs/, overview, warranty policy) |
| xiaomi-smart-tv-5a-80-cm-32-inch | same as above | India | ₹13,999 → ₹24,999 | live | ✓ (no box contents stated) | https://www.mi.com/in/product/xiaomi-smart-tv-5a-series/buy/ (item "Xiaomi Smart TV 5A 80 cm (32 inch) HD Ready LED Android TV (2022 Model)") |
| xiaomi-x-series-108-cm-43-inch-4k-ultra-hd-smart-android-tv-2023-demo-unit | same as above | India | ₹37,118.72 → ₹42,999 | live | ✓ (kept the demo-unit warranty text) | https://www.mi.com/in/product/xiaomi-smart-tv-x-series-2023/buy/ (item "Xiaomi Smart TV X 43 (108 cm)") |
| xiaomi-smart-tv-a-series-80-cm-32-inch-google-tv | same as above (identical on all 3 editions) | India (all 3 editions) | ₹13,999 → ₹24,999 (all 3 editions) | draft | Not done: edition unknown, kept current text (keywords cleaned only) | /in/product/xiaomi-smart-tv-a-series/buy/ (2023 "A 32"), xiaomi-smart-tv-a-series-2024/buy/ ("A32 2024 Edition"), xiaomi-smart-tv-a-series-2025/buy/ ("Smart TV 32 A GTV") |
| tcl-s5500-80-cm-32-inch-full-hd-led-smart-google-tv-2024 | not set | not set | unchanged (₹14,999 = price) | draft | Not done: no official source (keywords cleaned only) | none: tcl.com/in S5500 pages and support/model/32s5500 all return 404 |
| cellecor-s-43-109-cm-43-inch-ultra-hd-4k-smart-led-tv | Mfd and packed by Ekkaa Electronics (India) Pvt. Ltd., Noida; marketed by Cellecor Gadgets Limited | India | ₹27,999 → ₹35,999 | draft | Not done: kept current text (keywords cleaned only) | https://cellecor.com/products/cellecor-smart-tv-s-43-4k-43-inch |
| cellecor-109-cm-43-inch-full-hd-frameless-smart-led-tv | not set | not set | unchanged (₹20,999 = price) | draft | Not done: model not confirmed (keywords cleaned only) | none used (E-43P is the likely match, see below) |

Warranty on the two new live Xiaomi TVs: "1 year comprehensive warranty on the product plus 1 additional year on the panel". This is the "All Other Models" row of https://www.mi.com/in/support/policy/warranty/, and the A Pro spec page also says "1+1 Year Warranty".

## Draft because…
- **xiaomi-smart-tv-a-series-80-cm-32-inch-google-tv**: no photo, and the warranty and text are still generic. The edition (2023, 2024 or 2025) is unknown, so specs and description were not taken from any one edition.
- **tcl-s5500-80-cm-32-inch-full-hd-led-smart-google-tv-2024**: no photo, no manufacturer or origin, no MRP source, generic text. There is no official TCL India page for the S5500 any more.
- **cellecor-s-43-109-cm-43-inch-ultra-hd-4k-smart-led-tv**: no photo, generic warranty and text. Kept conservative as asked. Cellecor's page has only one line of description and no warranty statement.
- **cellecor-109-cm-43-inch-full-hd-frameless-smart-led-tv**: model not confirmed, no photo, no manufacturer or origin, generic text.

## Needs staff (read the box)
1. **All 4 Xiaomi TVs, manufacturerInfo**: Xiaomi publishes only the brand owner, "Manufactured For: Xiaomi Technology India Pvt Ltd". For the actual manufacturer and importer it says "as set out on the MRP label of the Product". Please read the manufacturer name and address from each box label so that text can replace the placeholder.
2. **xiaomi-smart-tv-a-series-80-cm-32-inch-google-tv, edition**: check the box for the edition and model number (2023 "A 32", 2024 "A32 2024 Edition" or 2025 "32 A GTV"). Only the fields that are identical on all three were filled (legal, India, MRP ₹24,999). Specs, photos and text need the exact edition.
3. **xiaomi-x-series-…-2023-demo-unit, platform name**: the stock sheet and product name say "Android TV", but Xiaomi's 2023 X Series page says Google TV ("Latest Google TV", "Year of Launch: 2023"). The content follows the official page; the product name was not changed. Please check the unit or box. There is also a pricing concern: our demo price is ₹37,118.72, but Xiaomi's own last listed price for a new X 43 (2023) is ₹23,999 (now out of stock). Owner may want to review this in the POS.
4. **tcl-s5500-80-cm-32-inch-full-hd-led-smart-google-tv-2024, manufacturer, origin and MRP**: no official source exists (TCL India pages return 404, and the Wayback Machine was unreachable). Read all three from the box label.
5. **cellecor-109-cm-43-inch-full-hd-frameless-smart-led-tv, model, manufacturer, origin and MRP**: the stock name "43"P" probably means the **E-43P**. cellecor.com lists the E-43P as Full HD 43 inch, MRP ₹35,999, made by Winsharp Electronics Pvt Ltd (Dharuhera), country of origin India. But the page never says "frameless", and Cellecor also sells the E-43V, E-43MT Plus, CE-43U GTV and CE-43U Pro FHD at 43 inch. Confirm the model on the box before using any of this.
6. **cellecor-s-43-…, manufacturer**: cellecor.com names Ekkaa Electronics (India) Pvt. Ltd. as manufacturer and packer for the S-43. Cellecor uses different contract makers on different models (Winsharp for the E-43P), so check that the box matches. The page also gives no address for "Cellecor Gadgets Limited". The S-43 page calls it an Android TV.
7. **Warranty statement for Cellecor and TCL**: none found on an official page.
8. **Box contents**: the A Pro spec page lists "In-box Contents: 1 TV Unit" only, with no remote, stand or manual. That looks incomplete, so it was left empty. Please confirm from the box.

## Notes
- Xiaomi data was checked on the buy page (rendered with Playwright) and in the `productdetail` JSON for these pages: xiaomi-a-pro-qled-tv-32, xiaomi-smart-tv-5a-series, xiaomi-smart-tv-x-series-2023, xiaomi-smart-tv-a-series(-2024/-2025). catalog/reference.json already points the A Pro, 5A and X 2023 photos at these same pages.
- Every MRP that was set is above the selling price in the local DB, so none ends up below the price.
- The keyword errors (single letters such as "a", "x") came from the export and were fixed in all 7 files.
