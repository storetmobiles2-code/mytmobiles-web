/**
 * Builds the static preview of the store for GitHub Pages.
 *
 *   npx tsx scripts/build-demo.ts            # → demo-site/
 *   DEMO_BASE_PATH=/repo-name DEMO_SITE_URL=https://owner.github.io/repo-name npx tsx scripts/build-demo.ts
 *
 * 1. `next build` in demo mode (NEXT_PUBLIC_DEMO=1, served under DEMO_BASE_PATH).
 *    Like any production build it reads the catalogue from DATABASE_URL. Point it
 *    at a freshly seeded database so the preview shows the stock sheet as-is,
 *    not stock left over from test orders.
 * 2. Starts that build and crawls every storefront page reachable from the home
 *    page, saving the rendered HTML (`/p/x` → `p/x.html`, which GitHub Pages
 *    serves at `/p/x`).
 * 3. Copies the JS/CSS bundles and public/ images next to the pages.
 *
 * In the preview the real UI hydrates as usual. The cart and wishlist live in
 * the browser, search and filters run client-side, and checkout and sign-in
 * explain that online ordering opens soon. See src/lib/demo.ts.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "demo-site");
const BASE = process.env.DEMO_BASE_PATH ?? "/mytmobiles-web";
const SITE = process.env.DEMO_SITE_URL ?? `https://storetmobiles2-code.github.io${BASE}`;
const PORT = Number(process.env.DEMO_PORT ?? 3200);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const env = { ...process.env, NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: BASE, NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_GA_MEASUREMENT_ID: "" };

/** Pages that can't work without a server, or aren't part of the shop front. */
const SKIP = [/^\/admin/, /^\/api\//, /^\/account/, /^\/invoice/, /^\/order-confirmation/, /^\/p\/[^/]+\/review/, /^\/reset-password/, /^\/verify-email/, /^\/media\//, /^\/_next\//];
const SEEDS = ["/", "/search", "/cart", "/checkout", "/wishlist", "/login", "/register", "/forgot-password", "/offers", "/open-box", "/about", "/contact", "/privacy", "/terms", "/help/shipping", "/help/returns", "/help/payments"];
const FILES = ["/demo-data.json", "/manifest.webmanifest", "/icon.png", "/apple-icon.png"];

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))));
  });
}

async function waitFor(url: string, server: ChildProcess) {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("next start exited early");
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function outFile(route: string): string {
  if (route === "/") return path.join(OUT, "index.html");
  return path.join(OUT, path.extname(route) ? route : `${route}.html`);
}

function save(route: string, body: Buffer | string) {
  const file = outFile(route);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function internalLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (href !== BASE && !href.startsWith(`${BASE}/`)) continue;
    const route = href.slice(BASE.length).split(/[?#]/)[0] || "/";
    if (path.extname(route) || SKIP.some((re) => re.test(route))) continue;
    out.add(route.replace(/\/$/, "") || "/");
  }
  return [...out];
}

async function crawl() {
  const queue = [...SEEDS];
  const seen = new Set(queue);
  let pages = 0;
  while (queue.length) {
    const route = queue.shift()!;
    const res = await fetch(`${ORIGIN}${BASE}${route === "/" ? "" : route}`, { redirect: "manual" });
    if (res.status !== 200) {
      console.warn(`  skip ${route} (${res.status})`);
      continue;
    }
    const html = await res.text();
    save(route, html);
    pages++;
    for (const link of internalLinks(html)) {
      if (!seen.has(link)) {
        seen.add(link);
        queue.push(link);
      }
    }
  }
  for (const route of FILES) {
    const res = await fetch(`${ORIGIN}${BASE}${route}`);
    if (!res.ok) throw new Error(`${route} → ${res.status}`);
    save(route, Buffer.from(await res.arrayBuffer()));
  }
  // GitHub Pages serves 404.html for unknown paths.
  const missing = await fetch(`${ORIGIN}${BASE}/this-page-does-not-exist`);
  fs.writeFileSync(path.join(OUT, "404.html"), await missing.text());
  // Account links (e.g. "Track your order") land on the sign-in page, as they would for a guest.
  for (const route of ["/account", "/account/orders"]) {
    fs.mkdirSync(path.dirname(outFile(route)), { recursive: true });
    fs.copyFileSync(outFile("/login"), outFile(route));
  }
  return pages;
}

async function main() {
  console.log(`Building the static preview for ${SITE}`);
  await run("npx", ["next", "build"]);

  // A leftover server on the port would be crawled instead of this build.
  if (await fetch(`${ORIGIN}${BASE}/api/health`).then(() => true, () => false)) throw new Error(`Port ${PORT} is already in use; stop that server or set DEMO_PORT.`);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // Own process group, so stopping it also stops the next-server child that npx spawns.
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "inherit", "inherit"], detached: true });
  try {
    await waitFor(`${ORIGIN}${BASE}/api/health`, server);
    const pages = await crawl();
    console.log(`✓ ${pages} pages`);
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      // already exited
    }
  }

  fs.cpSync(path.join(ROOT, ".next-demo", "static"), path.join(OUT, "_next", "static"), { recursive: true });
  fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });
  // Serve _next/ as-is (Jekyll would drop folders starting with "_").
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  fs.writeFileSync(path.join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");
  console.log(`✓ Static preview written to ${path.relative(ROOT, OUT)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
