# Samsung: legal, MRP and content report

Group: `samsung` (17 slugs). Samsung India pages were retrieved on 2026-10-15. The warranty page and the TV support pages were retrieved on 2026-10-19. `catalog validate` gives 0 errors on all 17.

`catalog apply` was run as a dry run on each slug. Every diff shows only the intended fields: manufacturerInfo, countryOfOrigin, variant mrp, the content fields (shortDescription, description, highlights, specs, boxContents, warranty, keywords, seoTitle, seoDescription) and sources. `status` changed in 3 files (the TV, S26 demo and S26 Ultra are now `draft`). That is not a database change: `draft` leaves visibility as it is, so it does not show in the diff. Prices, stock, images, stockSheetNames, HSN and GST were not touched. Photos come from the family pipeline, so `images` stays out of the files.

## Where the data comes from
- **Legal block:** the "Manufacturer's Information" section of each Samsung India per-SKU page (`samsung.com/in/smartphones/galaxy-a/<name>-<sku>ins/`). It is copied with its labels. Every SKU page of the same model gives the same text.
- **MRP:** the `price` field in the buy-page product data, which Samsung shows struck through as the MRP. The `promotionPrice` field is the offer price. For the family buy pages (`/in/smartphones/galaxy-a17/buy/` etc.) this is the `products` JSON. For per-SKU buy pages (`…/<sku>/buy/`, used for A06 5G, A07 5G and F17 5G) it is `newHybrisShopInfo`. This is the same method as the finished `samsung-galaxy-s25.json`.
- **Phone warranty:** https://www.samsung.com/in/support/warranty/, "Mobile Phones": handset 12 months, battery 12 months, other in-box accessories 6 months.

| slug | manufacturerInfo (short) | countryOfOrigin | MRP | status | Content | source |
|---|---|---|---|---|---|---|
| samsung-galaxy-a06-5g | Mfd by Dixon Technologies (India) Ltd., Noida; imported by Samsung India Electronics Pvt. Ltd., New Delhi | India | 6/128 Black ₹17,499 → ₹25,999. 4/128 Light Gray ₹23,999 confirmed. Others unchanged (see staff list) | live | ✓ (no box contents stated) | …/galaxy-a06-5g-black-64gb-sm-a066bzkdins/ (and other A06 5G SKU pages), …-sm-a066bzkhins/buy/, …-sm-a066bzagins/buy/ |
| samsung-galaxy-a06-5g-demo-unit | same as A06 5G | India | 4/64 Light Green unchanged (₹10,499 = price, no official MRP) | live | ✓ (kept the demo-unit warranty text) | …/galaxy-a06-5g-light-green-64gb-sm-a066blgdins/ |
| samsung-galaxy-a07-5g | Mfd by Dixon Technologies (India) Ltd., Noida; imported by Samsung India Electronics Pvt. Ltd. | India | 4/128 Black and Light Green ₹19,999 → ₹31,999. 6/128 all colours ₹22,999 → ₹34,999. 4/128 Light Violet unchanged | live | ✓ (no box contents stated) | …/galaxy-a07-5g-black-128gb-sm-a076bzkbins/ and the A07 5G SKU /buy/ pages |
| samsung-galaxy-a17-5g | Mfd by Samsung India Electronics Pvt. Ltd., New Delhi | India | ₹38,999 / ₹41,999 / ₹47,499 confirmed (no change). 8/256 Gray not listed, unchanged at ₹47,499 | live | ✓ (no box contents stated) | …/galaxy-a17-5g-black-128gb-sm-a176bzklins/, https://www.samsung.com/in/smartphones/galaxy-a17/buy/ |
| samsung-galaxy-a17-5g-demo-unit | same as A17 5G | India | 6/128 Gray ₹38,999 confirmed | live | ✓ (kept the demo-unit warranty text) | …/galaxy-a17-5g-gray-128gb-sm-a176bzalins/, galaxy-a17/buy/ |
| samsung-galaxy-a27-5g | Mfd by Samsung India Electronics Pvt. Ltd. | India | 6/128 ₹46,999 and 8/128 Black ₹51,999 confirmed. 8/128 Light Green (₹51,999) and 8/256 Light Green (₹40,499 = price) unchanged | live | ✓ (no box contents stated) | …/galaxy-a27-5g-light-green-128gb-sm-a276blgdins/, https://www.samsung.com/in/smartphones/galaxy-a27/buy/ |
| samsung-galaxy-a27-5g-demo-unit | same as A27 5G | India | 6/128 Light Green ₹46,999 confirmed | live | ✓ (kept the demo-unit warranty text) | as above |
| samsung-galaxy-a37-5g | Mfd by Samsung India Electronics Pvt. Ltd. | India | Graygreen 8/128 ₹60,999, 8/256 ₹68,499, Lavender 12/256 ₹77,999 confirmed. Awesome White (2 variants) unchanged | live | ✓ (no box contents stated) | …/galaxy-a37-5g-awesome-graygreen-128gb-sm-a376edgdins/, https://www.samsung.com/in/smartphones/galaxy-a37/buy/ |
| samsung-galaxy-a37-5g-demo-unit | same as A37 5G | India | 8/128 Lavender ₹60,999 confirmed | live | ✓ (kept the demo-unit warranty text) | …/galaxy-a37-5g-awesome-lavender-128gb-sm-a376elvdins/, galaxy-a37/buy/ |
| samsung-galaxy-a57-5g | Mfd by Samsung India Electronics Pvt. Ltd. | India | 8/256 Lilac ₹77,999 confirmed. 12/256 Icy Blue and Lilac unchanged (= price) | live | ✓ (no box contents stated) | …/galaxy-a57-5g-awesome-lilac-256gb-sm-a576bzvfins/, https://www.samsung.com/in/smartphones/galaxy-a57/buy/ |
| samsung-galaxy-a57-5g-demo-unit | same as A57 5G | India | 8/256 Awesome Navy ₹77,999 confirmed | live | ✓ (kept the demo-unit warranty text) | …/galaxy-a57-5g-awesome-navy-256gb-sm-a576bdbfins/, galaxy-a57/buy/ |
| samsung-galaxy-f17-5g | Mfd by Samsung India Electronics Pvt. Ltd. | India | 4/128 both colours ₹28,999 and 6/128 Neo Black ₹30,999 confirmed. 6/128 Violet Pop (₹30,999) and 8/128 (= price) unchanged | live | ✓ (no box contents stated) | …/galaxy-f/galaxy-f17-5g-black-128gb-sm-e176bzkains/ and its /buy/ pages |
| samsung-galaxy-s26-demo-unit | not set (labels disagree, see below) | India | 12/256 Cobalt Violet ₹1,17,999 confirmed | draft | ✓ (kept the demo-unit warranty text) | https://www.samsung.com/in/smartphones/galaxy-s26/buy/, …/galaxy-s/galaxy-s26-cobalt-violet-256gb-certified-re-newed-sm5s942bzvcins/ |
| samsung-galaxy-s26-ultra | not set (labels disagree, see below) | India | 12/256 Cobalt Violet ₹1,69,999 and 12/512 Sky Blue ₹1,89,999 confirmed | draft | ✓ | https://www.samsung.com/in/smartphones/galaxy-s26-ultra/buy/, …/galaxy-s26-ultra-cobalt-violet-256gb-certified-re-newed-sm5s948bzvbins/ |
| samsung-galaxy-tab-a11-lte-demo-unit | Mfd by Dixon Technologies (India) Ltd., Noida; imported by Samsung India Electronics Pvt. Ltd. | India | 4/64 Silver (SM-X135GZSAINS) ₹15,000 → ₹29,999 | live | ✓ (box contents from Samsung's FAQ; kept the demo-unit warranty text) | …/tablets/galaxy-tab-a/galaxy-tab-a11-silver-64gb-sm-x135gzsains/, https://www.samsung.com/in/tablets/galaxy-tab-a11/buy/ |
| samsung-galaxy-tab-a11-plus-5g | same as Tab A11 | India | 6/128 Gray (SM-X236BZAAINS) ₹34,999 → ₹47,999 | live | ✓ except warranty (left empty, see below) | …/galaxy-tab-a11-plus-gray-128gb-sm-x236bzaains/, galaxy-tab-a11/buy/ |
| samsung-crystal-4k-vivid-108-cm-43-inch-ultra-hd-led-smart-tv-2024 | not set | not set | unchanged (₹29,999 = price) | draft | Not done: model unknown. Keywords cleaned, and the warranty set from Samsung's general LED TV warranty | https://www.samsung.com/in/support/warranty/, support/model pages for the 6 candidates |

Full legal texts used (copied as published):
- A17, A27, A37, A57, F17: "Manufactured by: Samsung India Electronics Pvt. Ltd. having its Registered Office at: 6th Floor, DLF Centre, Sansad Marg, New Delhi-110001"
- A06 5G: "Manufactured by: Dixon Technologies (India) Ltd., Plot No. 6, Sector-90, Noida, Gautam Buddha Nagar, U.P. India-201305; Imported by: Samsung India Electronics Pvt. Ltd. having its Registered Office at: …"
- A07 5G: the same, with Samsung's slightly different spelling of the Dixon address ("Ltd.,Plot No. 6, Sector 90, Noida, U.P. India 201305").
- Tab A11 / A11+: "Manufactured by: Dixon Technologies (India) Ltd ,Plot no.6, Sector 90, Noida, Gautam Buddha Nagar, U.P. India – 201305; Imported by: Samsung India Electronics Pvt. Ltd. …"

## Draft because…
- **samsung-galaxy-s26-demo-unit** and **samsung-galaxy-s26-ultra**: no manufacturerInfo. Samsung India has no per-SKU page for the new S26 or S26 Ultra. The only per-SKU legal blocks are on the Certified Re-Newed pages for the same model codes (SM5S942…, SM5S948…), and they say "Manufactured by: Samsung India Electronics Pvt. Ltd., …". The buy pages' FAQ says "IMPORTED BY: Samsung India Electronics Pvt. Ltd. …" for the same models. The company, address and country of origin (India) agree, but the role does not. Country of origin was set to India because both sources say so. Specs and content come from the Re-Newed pages, which describe the same model.
- **samsung-crystal-4k-vivid-108-cm-43-inch-ultra-hd-led-smart-tv-2024**: the exact model is unknown. The six candidates are UA43DUE76AKLXL (best guess), UA43DUE77AKLXL, UA43DUE70BKLXL, UA43DUE80AKLXL, UA43DU7000KLXL and UA43DU7700KLXL. Samsung India has retired their sales pages, and the support pages have no specs, legal block or MRP, so nothing can be confirmed for all six. The only change is the warranty: Samsung's warranty page gives 12 months for every LED/LCD TV, with remote and accessories at 12 months exchange, which covers all six candidates. Product text and specs stay as they were.

## Needs staff (read the box)
1. **S26 demo and S26 Ultra, manufacturerInfo**: read the box label. Is Samsung India Electronics Pvt. Ltd. the "Manufacturer" or the "Importer"? Copy the exact label text.
2. **Crystal 4K Vivid 43" TV, model number**: read it from the box or the back label. Once known, legal, origin, MRP, specs and photos can be filled from that model's pages.
3. **Galaxy A37 5G "Awesome White" (8/256 and 12/256)**: Samsung India sells only Awesome Graygreen, Lavender and Charcoal. No White SKU (SM-A376EZW…INS) exists. Check the box: it may be a mis-keyed colour on the stock sheet. Both MRPs were left unchanged (₹68,499 and ₹77,999).
4. **MRPs not on any Samsung India page** (left unchanged; please read the box):
   - A06 5G: 4/64 all three colours (₹15,999 / ₹15,999 / ₹14,999, all equal to the price); 6/128 Light Green (₹17,499 = price; the Black 6/128 MRP is ₹25,999, so this is probably the same); 4/128 Black and Light Green (₹23,999, which matches the Light Gray MRP but was not shown for these colours).
   - A06 5G demo unit: 4/64 Light Green (₹10,499 = price).
   - A07 5G: 4/128 Light Violet (₹19,999 = price; the other 4/128 colours are ₹31,999).
   - A17 5G: 8/256 Gray (₹47,499, same as the Black and Blue MRP but not listed for Gray).
   - A27 5G: 8/128 Light Green (₹51,999) and 8/256 Light Green (₹40,499 = price).
   - A57 5G: 12/256 Awesome Icy Blue (₹72,499 = price) and 12/256 Awesome Lilac (₹62,499 = price). Samsung India sells only the 8/256 now. The 12/256 SKU pages exist but show no price.
   - F17 5G: 6/128 Violet Pop (₹30,999) and 8/128 both colours (₹25,999 / ₹23,999 = price).
5. **Tab A11+ 5G warranty**: the Samsung India warranty page lists phones, wearables, TVs and so on, but no tablet row. It was left empty rather than guessed. Please confirm from the warranty card.
6. **Demo units (A06, A17, A27, A37, A57, S26, Tab A11)**: the existing warranty text was kept ("Manufacturer warranty as applicable from the original activation date — ask us for the remaining period"). Please confirm it is still correct for each unit.
7. **Large MRP increases** to check against the box before merging: A07 5G (₹19,999 → ₹31,999 and ₹22,999 → ₹34,999), A06 5G 6/128 Black (₹17,499 → ₹25,999), Tab A11 LTE demo (₹15,000 → ₹29,999), Tab A11+ 5G (₹34,999 → ₹47,999). These are Samsung India's listed MRPs (the struck-through price). The offer prices on the same pages are much lower: ₹20,999, ₹23,999, ₹19,999, ₹22,999 and ₹31,999.

## Notes
- Every MRP that was set is at or above the selling price in the local DB.
- A few phone specs are not given on Samsung India's spec lists, so they were left out: the chipset name for A07, A17, A37 and A57, and charging wattage for A07, A17, A27 and A37. Chipsets that are named were taken from Samsung's own page text: Dimensity 6300 (A06 5G FAQ), Snapdragon 6 Gen 3 (A27), Exynos 1330 (F17), Exynos 2600 (S26) and Snapdragon 8 Elite Gen 5 for Galaxy (S26 Ultra).
- Box contents are filled only for the two tablets, from Samsung's FAQ: quick start guide, ejection pin and USB Type-C data cable. Samsung does not list phone box contents. For the S26 and S26 Ultra it says only that no travel adapter is included, and the description says so.
- Screen sizes in inches were converted from Samsung's cm figures and rounded to one decimal, as in the S25 file. For example, 17.13 cm becomes 6.7 inch.
- The TV file's keywords had single-letter and bracketed junk from the export ("d", "(2024"). They were replaced, which fixes the validate error.
