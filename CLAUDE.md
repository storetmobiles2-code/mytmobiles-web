@AGENTS.md

# myT Mobiles store — operations

Online store for myT Mobiles (Next.js 16, Prisma 7, PostgreSQL). See README.md for setup and docs/agents.md for how the store is maintained.

**Starting a new session? Read `docs/progress.md` first.** It lists what's done, what's unfinished and exactly how to pick it up.

- House rules for catalogue, photos, pricing, legal disclosures and safety: `.claude/skills/store-rules/SKILL.md`. Load it before touching products or anything customers see.
- Runtime harness (myBillBook sync, price gates, i3 host, Discord approvals, which tier may call an LLM): `.claude/skills/harness-rules/SKILL.md`. Load it before changing the sync, POS endpoints, price guards or the i3 stack.
- Reusable role agents (product manager, program manager, architect, systems/devops/full-stack engineer, security, budget auditor, SEO, escalations) come from the owner's `agent-toolkit` plugin, installed at user scope. Project rules here override theirs.
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

`graphify-out/` holds a knowledge graph of the code: symbols, imports, calls, and communities named after their folders. It's built locally from the source by tree-sitter, with no LLM calls. It's git-ignored and rebuilt automatically at session start by a `SessionStart` hook (`.claude/settings.json` → `scripts/graph.sh`). The script installs graphify through `uv` if it's missing (`graphifyy[sql,mcp]` on PyPI; it needs Python 3.10+, so `brew install uv` first on a new Mac) and builds the graph in about 30 seconds. The `graphify-mcp` server, registered at user scope, serves the same graph over MCP. If `graphify-out/graph.json` is missing anyway, run `npm run graph`. The PreToolUse hooks call `graphify hook-guard`, which only adds a reminder and never blocks.

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
