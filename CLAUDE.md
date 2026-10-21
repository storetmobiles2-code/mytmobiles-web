@AGENTS.md

# myT Mobiles store — operations

Online store for myT Mobiles (Next.js 16, Prisma 7, PostgreSQL). See README.md for setup and docs/agents.md for how the store is maintained.

**Starting a new session? Read `docs/progress.md` first.** It lists what's done, what's unfinished and exactly how to pick it up.

- House rules for catalogue, photos, pricing, legal disclosures and safety: `.claude/skills/store-rules/SKILL.md`. Load it before touching products or anything customers see.
- How to change and test the code (local databases, quality gates, e2e, admin permissions and audit logging, parallel agents in worktrees): `.claude/skills/store-dev/SKILL.md`. Load it before writing or merging code.
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

## Code graph (graphify): use it before searching

`graphify-out/` holds a knowledge graph of the code: symbols, imports, calls, and communities named after their folders. It's built locally from the source by tree-sitter, with no LLM calls. It's git-ignored, so **at the start of every session run `npm run graph`** (`scripts/graph.sh`). It installs graphify if it's missing (`graphifyy[sql]` on PyPI, via `uv tool install`) and builds the graph in a few seconds. The PreToolUse hooks in `.claude/settings.json` call `graphify hook-guard`, which only adds a reminder and never blocks. Until the first `npm run graph` in a fresh container they report "command not found", which is harmless.

Rules, to keep token use down:
- **Codebase questions:** before your first grep, glob or source-file read, ask the graph:
  - `graphify query "<question>" --budget 1500` to find where something lives;
  - `graphify explain "<symbol or file>"` for one thing and its neighbours;
  - `graphify path "<A>" "<B>"` for how two things connect;
  - `graphify affected "<symbol>"` for what a change would touch.

  Then read only the files and lines it points to. A plain grep for an exact string you already know (an error message, a route path) is fine.
- **Subagents:** put the same rule in every subagent prompt that explores code.
- **Broad orientation:** for architecture work, read `graphify-out/GRAPH_REPORT.md` (hubs, god nodes, communities). Don't read `graph.json` directly.
- **After changing code:** run `npm run graph` (a few seconds) so later queries see the change. Never commit `graphify-out/`.
- **Limits:** the graph covers code, not prose (docs, product JSON, Prisma schema text). Search those directly.
