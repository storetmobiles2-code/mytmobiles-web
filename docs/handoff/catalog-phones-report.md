# Phones and others: legal, MRP and content report

Group: `phones-other` (12 slugs). Sources were retrieved between 2026-10-15 and 2026-10-20, and each `sources` entry carries its own date. `catalog validate` gives 0 errors on all 12. `catalog apply` was run as a dry run on each one. Every diff shows only the intended fields: manufacturerInfo, countryOfOrigin, variant mrp (vivo Y05 and Y11 only), and the content fields (shortDescription, description, highlights, specs, boxContents, warranty, keywords, seoTitle/seoDescription). `status` changed to `draft` in 7 files. That is not a database change, so it does not show in the diff.

| slug | manufacturerInfo (short) | countryOfOrigin | MRP | status | Content | source |
|---|---|---|---|---|---|---|
| apple-iphone-17 | Mfr Apple Inc, Cupertino; importer and packer Apple India Pvt Ltd, Bengaluru | India, China (as Apple publishes it) | unchanged ₹82,900 (launch MRP; Apple now lists ₹99,900, see staff item 1) | live | ✓ | https://www.apple.com/in/shop/api/product/legalmetrology?product=MG6J4HN/A (the buy page's "Product Information" block), /in/shop/buy-iphone/iphone-17, /in/newsroom/2025/09/apple-introduces-iphone-17/, /in/iphone-17/specs/, /in/applecare/ |
| apple-iphone-15 | not set | not set | unchanged (₹52,999–₹69,900 = price) | draft | ✓ | https://support.apple.com/en-in/111831 (specs); no longer sold by Apple India, and the legal API returns HTTP 500 for its part numbers |
| apple-ipad-9th-generation-wi-fi | not set | not set | unchanged (₹29,900 = price) | draft | ✓ | https://support.apple.com/en-in/111898 (specs); discontinued |
| apple-airpods-4 | not set | not set | unchanged (₹12,900 = price) | draft | ✓ only for fields that are the same on both AirPods 4 models | https://support.apple.com/en-in/121203 and /121204 (non-ANC and ANC specs); Apple India now sells AirPods 5 |
| vivo-y05 | Mfr vivo Mobile India Pvt Ltd, Plot 8, Sector-24, Yamuna Expressway, Gautam Buddha Nagar, UP 201310 | India | ₹12,999 → ₹34,999 | live | ✓ | https://shop.vivo.com/in/product/10355, https://www.vivo.com/in/products/param/y05, https://www.vivo.com/in/index/warrantyTerms |
| vivo-y11-5g-demo-unit | same as Y05 | India | ₹14,999 → ₹39,999 (4 GB + 64 GB) | live | ✓ (demo text and demo warranty kept) | https://shop.vivo.com/in/product/10357, https://www.vivo.com/in/products/param/y11-5g |
| vivo-y31-5g-demo-unit | same as Y05 | India | unchanged ₹25,999: vivo's 4 GB + 128 GB MRP is ₹19,999, below our price (see staff item 3) | live | ✓ (demo text kept) | https://shop.vivo.com/in/product/10359, https://www.vivo.com/in/products/param/y31-5g |
| oneplus-u-series-65u1s-164-cm-65-inch-4k-led-smart-tv | Mfr Radiant Appliances And Electronics Pvt Ltd, Fabcity, Ranga Reddy, Telangana 501141 | India | unchanged (₹62,999 = price) | live | ✓ | https://www.oneplus.in/tv-u1s-series (per-size spec and legal block for the 65 U1S), https://www.oneplus.in/support/warranty-policy |
| oppo-reno-10-5g | not set | India | unchanged (₹32,999 = price) | draft | ✓ (warranty left empty) | https://www.oppo.com/in/smartphones/series-reno/reno10/specs/ (CPH2531), launch press release |
| oppo-a58 | not set | not set | unchanged (₹12,999 = price) | draft | ✓ specs only from the global page (box contents and warranty left empty) | https://www.oppo.com/en/smartphones/series-a/a58/specs/ (CPH2577); the India page redirects to the smartphone list |
| philips-s7221-5g | not set | not set | unchanged (₹20,999 = price) | draft | ✓ (warranty left empty) | https://www.philips.co.in/c-p/CTS7221BKA_94, Philips PRX specification data and the official TPV leaflet PDF for CTS7221BKA/94 |
| fastrack-revolt-fs1-bluetooth-calling-smartwatch | not set | not set | unchanged (₹2,999 = price) | draft | Not done: generic text removed, warranty left empty, keywords cleaned | none: fastrack.in and titan.co.in return Cloudflare 403 to our fetches |

Warranty text used:
- Apple: "1 year Apple limited warranty …". Sources are apple.com/in/applecare ("Most Apple products come with 1 year of hardware coverage through the limited warranty") and the AirPods buy page ("Every AirPods or Beats product comes with one-year limited warranty").
- vivo: 1 year on the handset and 6 months on the charger and cable, from vivo India's warranty terms. Demo units say the warranty runs from the original activation date.
- OnePlus TV: "one-year comprehensive warranty on OnePlus TV and two years warranty on the panel from the date of delivery", from the OnePlus India warranty FAQ.

## Draft because…
- **apple-iphone-15, apple-ipad-9th-generation-wi-fi**: no manufacturer or origin. Apple's Legal Metrology block only exists for models it still sells.
- **apple-airpods-4**: no manufacturer or origin, for the same reason. The model (with or without ANC) is also unknown.
- **oppo-a58**: no manufacturer, origin, MRP or warranty source. Only the global spec page exists.
- **oppo-reno-10-5g**: no manufacturer or importer on OPPO India's page (origin is given), and no MRP or warranty statement.
- **philips-s7221-5g**: Philips India publishes no legal block, MRP or warranty. Philips India lists only the Black part number (CTS7221BKA/94), and we stock Black, Blue and Gray.
- **fastrack-revolt-fs1-bluetooth-calling-smartwatch**: no official page could be read, there is no photo, and the strap colour is unknown.

## Needs staff (read the box)
1. **apple-iphone-17, MRP**: Apple raised the India MRP from ₹82,900 (launch, Sept 2025) to ₹99,900 (Sept 2026, "Listed pricing is Maximum Retail Price"). Units bought before the revision may carry ₹82,900 on the box, so the file keeps ₹82,900 (= price, no discount shown). Read each box: if it says ₹99,900, that value can be set.
2. **apple-iphone-17, country of origin**: Apple declares "INDIA, CHINA" for every iPhone 17 part number, and the file uses that. The box shows the origin of each unit.
3. **vivo-y31-5g-demo-unit, price above MRP**: vivo's shop data lists the 4 GB + 128 GB MRP as ₹19,999, but our POS price for this demo unit is ₹25,999. MRP was not set. vivo's 4 GB + 128 GB entry looks stale: it is not selectable, and the 6 GB + 128 GB MRP is ₹44,999. Please read the box MRP and review the POS price, because a selling price above the box MRP is not allowed.
4. **vivo-y05 (₹34,999) and vivo-y11-5g-demo-unit (₹39,999), MRP**: these are vivo's own "MRP (incl. of all taxes)" figures, the same for every colour of that RAM and storage. They are much higher than vivo's own selling prices (₹15,999 and ₹18,999), so please confirm against the box. vivo also uses different colour names on its shop and product pages: Y05 "Straw Gold" on the shop page and "Champagne Gold" on the product page; Y11 "Mystic Blue" and "Midnight Blue".
5. **apple-iphone-15, apple-ipad-9th-generation-wi-fi, apple-airpods-4, manufacturer, origin and MRP**: read them from the box. For AirPods 4, also check whether the box says "with Active Noise Cancellation". Apple's launch MRPs were ₹12,900 (AirPods 4) and ₹17,900 (with ANC). The current iPhone 15 MRPs in the file (₹52,999 Green, ₹54,999 Pink) are not Apple MRPs, which end in 900.
6. **oppo-a58, oppo-reno-10-5g, manufacturer and importer, MRP, warranty**: OPPO India gives none of these for discontinued models (Reno10's origin, India, is from its spec page). Also confirm the A58's model code is CPH2577.
7. **philips-s7221-5g, manufacturer and importer, origin, MRP, warranty, and colours**: read them from the box. Specs are from the Black model's official data. Reports say the 6 GB + 128 GB launch price is ₹20,499 (Amazon), but that is not an MRP.
8. **oneplus-u-series-65u1s-…, MRP**: OnePlus India's buy page loads prices by script and its API returns no data for the discontinued U1S, so no MRP was found. Read the box.
9. **fastrack-revolt-fs1-…, everything**: Fastrack's own name is "Revoltt FS1" (for example 38152PP02K, blue strap). Read the model number, strap colour, MRP, manufacturer or marketer, and origin from the box.

## Notes
- The OnePlus legal block lists Radiant Appliances as manufacturer for all three U1S sizes. Older units may have a different contract maker, so the box wins.
- `is5G` is `false` on apple-iphone-15 and apple-iphone-17, but both are 5G phones. That field was outside this task's scope and was left unchanged.
- The keyword errors (single letters such as "u", and "17") came from the export and were fixed in all 12 files.
- Playwright could not be used: Chromium does not trust the proxy CA. Adding the CA to the NSS store was blocked as a TLS change and was undone. All pages were read with curl and from embedded page JSON. `libnss3-tools` was installed during that attempt and is still installed.
