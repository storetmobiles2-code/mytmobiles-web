# Progress and handoff

**Last updated:** 21 October 2026. **Working branch:** `ccr-34a23bd2-6at1mf`. It has everything below, and nothing in it is on `main` yet. No pull request is open for it.

Read this first in a new session. Then read `CLAUDE.md`, `.claude/skills/store-rules/SKILL.md` and `.claude/skills/store-dev/SKILL.md`.

## Done and on `main` (PRs #1 and #2, merged)

- **Storefront:**
  - search, filters, product pages with multi-view galleries and a 360° viewer;
  - cart and checkout (COD and Razorpay), pincode delivery estimates;
  - accounts and GST invoices.
- **Admin:** orders, inventory and stock-sheet import, products and photos (including 360° uploads), banners, coupons, settings and analytics.
- **Catalogue toolchain:** `npm run catalog`, `npm run ops`, the photo pipeline, and seven maintenance agents (`.claude/agents/`).
- **Static demo** on GitHub Pages: https://storetmobiles2-code.github.io/mytmobiles-web/. It's built from the 5 October code, so none of the work below is in it yet.

## Done on the working branch (not yet in a PR)

| Area | What | Where |
|---|---|---|
| Grievances (launch blocker) | Grievance officer fields in Settings, shown on Contact, Terms and the footer. Complaint form with tickets `GRV-YYYY-NNNNNN`, tracking by ticket + email, Admin → Grievances with 48 h / 1-month overdue flags, daily ops brief counts | `src/lib/grievances/`, `src/app/(store)/help/grievance`, `src/app/admin/grievances` |
| Staff roles + audit log | `STAFF` role and a permission map. `requirePermission()` / `assertPermission()` on every admin page and action. Admin → Staff (invite, role, disable; the last admin is protected). Admin → Activity and per-entity History. `audit()` on every admin mutation and on `catalog apply --write`. Packing slip page | `src/lib/auth/permissions.ts`, `src/lib/admin/audit.ts`, `src/app/admin/staff`, `src/app/admin/activity` |
| GST export | Admin → Reports → GST (GSTR-1): invoice register, B2B, B2CL (> ₹1 lakh), B2CS, HSN (B2B/B2C), docs issued, refunds, sales summary. ZIP of CSVs (owner only, audited) | `src/lib/reports/`, `src/app/admin/reports` |
| Product data | 17 product files with official manufacturer, origin, MRP and real content: 7 TVs and 10 coolers. 8 are `live`; 9 are `draft` (visibility unchanged) pending box checks | `catalog/products/*.json`, `docs/handoff/catalog-*-report.md` |
| Toolchain | `catalog validate` counts photos from the family pipeline. Lint and typecheck ignore agent worktrees | `scripts/catalog.ts`, `src/lib/catalog/product-spec.ts` |

Merge integration decisions:
- Grievances are handled by ADMIN and STAFF (`grievances.manage`).
- GST reports are ADMIN only (`reports.view`).
- Grievance updates and GST exports are written to the audit log.

Checks run on the merged branch: lint, typecheck, unit tests (110), the production build and the full e2e suite (47) pass.

## Unfinished: pick up here

### 1. Two-factor sign-in for admin (launch blocker, about 90% done)
The full work-in-progress is in `docs/handoff/two-factor-wip.patch`. It's a diff against `main` (5bd5452), with 26 files, including migration `20261015152739_admin_two_factor`. What it covers:
- TOTP (RFC 6238) with replay protection;
- secrets encrypted with `TOTP_ENCRYPTION_KEY`, and hashed single-use recovery codes;
- a `/login/verify` step, and Admin → Security for enrolment and recovery codes;
- enforcement for everyone who can open `/admin` (`ADMIN_2FA_ENFORCED=false` turns it off for local development only);
- `scripts/reset-2fa.ts`, and unit and e2e tests.

To finish:
```bash
git checkout -b twofa-finish origin/main            # or a worktree; see store-dev skill
git apply --3way docs/handoff/two-factor-wip.patch
npm install                                          # the patch adds dependencies to package.json
# then: lint, typecheck, unit, build, full e2e. The agent stopped just before build + e2e.
git checkout ccr-34a23bd2-6at1mf && git merge twofa-finish
```

Expected merge conflicts:
- **`src/lib/auth/guards.ts`:** keep the roles version, and call the 2FA check inside `requireAdmin()`/`assertAdmin()`. `requirePermission`/`assertPermission` call those, so 2FA covers every admin page and action.
- **`src/app/admin/layout.tsx`:** add `/admin/security` to the nav for everyone in the admin area.
- **`tests/e2e/global-setup.ts`, `fixtures.ts`, `checkout.spec.ts`:** keep both the staff user (roles) and the enrolled e2e admin (2FA). The staff e2e user needs 2FA enrolment too.

The patch also adds `src/proxy.ts`, which is Next 16's replacement for middleware; read `node_modules/next/dist/docs/` before changing it. Then update `docs/production-guide.md` §6.1 and §9 item 3.

### 2. Product files for Samsung (17) and other phones (12)
Partly researched files are parked in `catalog/products/_wip/`, where validation and CI skip them. Move them back to `catalog/products/` and finish them with the catalog-editor agent, following "Catalogue research" in the store-rules skill. When `npm run catalog -- validate` shows 0 errors, commit them. The slug lists are the `samsung-*` files, plus apple, oppo, vivo, oneplus, philips and fastrack.

### 3. Then
1. Run the full e2e suite on the merged branch, then open a PR from `ccr-34a23bd2-6at1mf` to `main`.
2. Rebuild and redeploy the demo (`npm run demo:build` against a freshly seeded `mytmobiles_demo` database), then push `demo-site/` to `gh-pages`.
3. Remaining code gaps (`docs/production-guide.md` §9):
   - error tracking and 180-day log retention;
   - Shiprocket courier integration;
   - DPDP data export and account deletion;
   - credit notes (GSTR-1 Table 9B).

## Waiting on the owner or staff

**Read the box in the shop.** Full lists are in `docs/handoff/catalog-*-report.md`.
- **Manufacturer, origin and MRP:**
  - Crompton Supremus 70L, Kenstar Doublecool DX 60L, Voltas Grand 52E, TCL S5500 32";
  - Orient Ultimo 88L (manufacturer, origin and warranty).
- **Exact model:**
  - Xiaomi A Series 32 (2023, 2024 or 2025 edition);
  - Cellecor 43" Full HD (E-43P?);
  - Samsung Crystal 4K Vivid 43" (UA43DUE76AKLXL?).
- **Real manufacturer and importer for all Xiaomi TVs.** Xiaomi only says "as set out on the MRP label".
- **Orient Tornado colour:** "Dark Grey" vs "Black".
- **Other checks:** AirPods 4 (ANC or not), vivo colour names, and the X Series 43 "Android TV" vs Google TV.
- **Photos (none official):** 10 products still show a placeholder. Photograph them in the shop and upload in Admin with the credit "Photographed in store".

**Decisions for the owner:**
- **Grievances:**
  - Does the automatic receipt email count as the 48-hour acknowledgement? Currently it doesn't; the first staff update does.
  - "One month" is currently the earlier of one calendar month or 30 days.
  - Recheck the wording against the official Consumer Protection (E-Commerce) Rules PDF.
- **GST:** have a CA confirm:
  - B2CS type "OE";
  - whether to issue credit notes for returns;
  - whether the offline tool accepts the UTF-8 BOM;
  - the hsn.csv column order.
- **Staff:**
  - Should staff see customer details or History panels? Both are owner-only now.
  - Should the packing slip show the COD amount?
- **Pricing:** the X Series 43 demo unit costs ₹37,119, but Xiaomi sold the new TV at ₹23,999. Check the POS.
- **Smartwatches:** the POS stock sheet has only one (Fastrack Revolt FS1). Add more to the POS, or send a list to onboard.
- **Accounts and launch:** GSTIN, Razorpay KYC, domain, hosting and database (see production-guide §2).

## Verification

Results of the last full run on the merged branch are recorded here.

- **Unit tests:** 110 passed.
- **Production build:** passed.
- **e2e (Playwright, fresh seeded database):** 47 of 47 passed on desktop and mobile on 21 October 2026, after merging grievances, roles and GST. Recipe in the store-dev skill.
