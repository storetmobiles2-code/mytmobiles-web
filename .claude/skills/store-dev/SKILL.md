---
name: store-dev
description: How to change the myT Mobiles store's code safely — local setup, databases, quality gates, e2e, demo mode, admin permissions and audit logging, and running several agents in parallel with git worktrees. Load before writing or merging code in this repository.
---

# Working on the store's code

Next.js 16 App Router, React 19, Prisma 7 (`prisma-client` generator → `src/generated/prisma`, PrismaPg adapter), PostgreSQL 16, Tailwind 4, Zod 4, Vitest, Playwright.

**This Next.js has breaking changes.** Read `node_modules/next/dist/docs/` before using an API you're not sure of:
- route handlers use `revalidateTag(tag, { expire: 0 })`; `updateTag` works only in server actions;
- page props use the `PageProps<"/route">` type;
- `src/proxy.ts` replaces middleware.

Never run `next dev`, because it rewrites `AGENTS.md`. If it does, run `git checkout AGENTS.md`.

The current state of the project and the unfinished work are in `docs/progress.md`.

**Navigate with the code graph:** run `npm run graph` at the start of a session, then `graphify query|explain|path|affected` before grepping or reading files. Rebuild after code changes. See the "Code graph" section in `CLAUDE.md`.

## Local setup (cloud container)

```bash
service postgresql status >/dev/null 2>&1 || service postgresql start   # needed again after every container restart
npm ci                                     # postinstall runs prisma generate
npx prisma migrate deploy && npx prisma db seed   # DATABASE_URL from .env
```

Databases on `localhost` (user `myt`, password `myt_dev_pw`):

| Database | Use |
|---|---|
| `mytmobiles` | dev |
| `mytmobiles_demo` | static demo build, reseeded fresh each time |
| `mytmobiles_<track>` | one per parallel agent |
| `mytmobiles_merge` | e2e on merged branches |

e2e places orders and uses up stock, so run it against a freshly seeded database:
```bash
export PGPASSWORD=myt_dev_pw DATABASE_URL=postgresql://myt:myt_dev_pw@localhost:5432/mytmobiles_merge
psql -h localhost -U myt -d postgres -c "DROP DATABASE IF EXISTS mytmobiles_merge" -c "CREATE DATABASE mytmobiles_merge"
npx prisma migrate deploy && npx prisma db seed && npm run build
npx next start -p 3410 &   # wait for /api/health
E2E_BASE_URL=http://localhost:3410 npx playwright test
```

Chromium is preinstalled at /opt/pw-browsers; never run `playwright install`.

Ports already in use or reserved:

| Port | Used by |
|---|---|
| 3100 | e2e default |
| 3200 | demo build |
| 3300 | manual preview |
| 4000 | Pages mock |
| 3401+ | parallel agents |

## Quality gates (all must pass before a push)

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, the full Playwright suite, and `npm run catalog -- validate` (CI runs it on every product file).

New pages need:
- an axe WCAG 2.1 AA check (see `tests/e2e/a11y.spec.ts`);
- no sideways scroll at 390 px.

## Conventions

- **Money** is integer paise (`src/lib/money.ts`). Product files store MRP in rupees.
- **Settings** go through `src/lib/settings.ts`, which is cached.
- **Server actions** pair with `useActionState`, as in `src/components/admin/*-forms.tsx`.
- **Admin pages and actions** must declare a permission from `src/lib/auth/permissions.ts`:
  - pages: `await requirePermission("…")` at the top;
  - server actions and route handlers: `const admin = await assertPermission("…")`;
  - add the link to `NAV` in `src/app/admin/layout.tsx` with the same permission.

  `requireAdmin()`/`assertAdmin()` only mean "may enter /admin" (ADMIN or STAFF). Money, catalogue, settings, reports, staff and the activity log are ADMIN only.
- **Every admin mutation** calls `audit({ actor: admin, action: "thing.verb", entityType, entityId, summary, changes })` from `src/lib/admin/audit.ts`. `diffChanges()` builds `changes`. It never throws, and it drops secrets.
- **Schema changes** are additive only (nullable columns or columns with defaults, new tables). Create them with `npx prisma migrate dev --name …` against your own database. Never hand-edit `src/generated/`.
- **Demo mode** (`NEXT_PUBLIC_DEMO=1`, `src/lib/demo.ts`) builds a static GitHub Pages copy with no server. New storefront pages must render there and show an honest notice instead of submitting forms. Add new public routes to `SEEDS`, and private ones to `SKIP`, in `scripts/build-demo.ts`.
- **Copy** is plain Indian English, as in the store-rules skill.

## Running agents in parallel

Use this for several independent features at once. It worked for grievances, roles, GST and 2FA.

1. **Give each code agent its own worktree** (Agent tool `isolation: "worktree"`, under `.claude/worktrees/`, which is git-ignored and lint-ignored). In the worktree:
   ```bash
   cp -al /home/user/mytmobiles-web/node_modules ./node_modules   # hard-link copy; or npm ci
   cp /home/user/mytmobiles-web/.env .env    # then point DATABASE_URL at mytmobiles_<track>
   ```
   Give each agent its own database and e2e port, and tell it to commit to its own branch and never push.
2. **Catalogue research agents** work in the main checkout and touch only their own `catalog/products/<slug>.json` files. They don't commit; the lead commits each group once it validates.
3. **Run at most about 3 agents at a time.** Eight at once hit the account usage limit repeatedly; each resume reloads the whole transcript, which wastes most of the gain. If an agent stops on a limit, resume it with SendMessage after the reset, not with a new agent.
4. **The lead merges** branches one at a time with `--no-ff`, resolves conflicts, and runs the gates after each merge. Expect conflicts in:
   - `src/app/admin/layout.tsx` (nav and icon imports);
   - `src/lib/auth/guards.ts`;
   - `src/app/admin/actions/store.ts`;
   - `scripts/build-demo.ts` (SKIP/SEEDS);
   - `docs/production-guide.md` §9.

   Code written before the permissions system needs `requirePermission`/`assertPermission` + `audit()` added at merge.
5. **Worktrees exist only in this container.** Before a session ends, commit or export unfinished work, for example `git diff --binary <base> > docs/handoff/<track>-wip.patch`.

## Git

- Develop on the session's designated branch, and open PRs into `main`, the default branch.
- Never force-push other people's branches.
- `gh-pages` holds the generated demo, pushed from `demo-site/`.
- Commit messages end with the attribution lines the session specifies.
