@AGENTS.md

# myT Mobiles store — operations

Online store for myT Mobiles (Next.js 16, Prisma 7, PostgreSQL). See README.md for setup and docs/agents.md for how the store is maintained.

- House rules for catalogue, photos, pricing, legal disclosures and safety: `.claude/skills/store-rules/SKILL.md`. Load it before touching products or anything customers see.
- Maintenance agents in `.claude/agents/`:
  - `product-onboarder`: new products
  - `catalog-editor`: changes to existing products
  - `image-curator`: photos
  - `stock-keeper`: stock-sheet review
  - `ops-monitor`: daily brief
  - `site-auditor`: weekly audit
  - `release-manager`: code changes, upgrades and deploys
- Product data lives in `catalog/products/<slug>.json` and is changed only through pull requests (`npm run catalog -- help`).
- Never write to the production database directly, merge your own PR, or commit secrets.
