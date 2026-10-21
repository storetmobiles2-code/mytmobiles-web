/**
 * Names graphify's code communities without an LLM: each community is named
 * after the folder most of its symbols come from, plus its best-connected
 * symbol. Writes graphify-out/.graphify_labels.json, which
 * `graphify cluster-only` then uses in GRAPH_REPORT.md.
 *
 *   npm run graph     # rebuilds the graph, labels it and regenerates the report
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "graphify-out");
const graph = JSON.parse(fs.readFileSync(path.join(OUT, "graph.json"), "utf8"));
const links = graph.links ?? graph.edges ?? [];

const degree = new Map();
for (const l of links) for (const end of [l.source, l.target]) degree.set(end, (degree.get(end) ?? 0) + 1);

/** "src/app/admin/orders/[id]/page.tsx" → "src/app/admin/orders" (dynamic segments and file names dropped). */
const folderOf = (file) => {
  const parts = path.dirname(file).split("/").filter((p) => p && p !== "." && !p.startsWith("[") && !p.startsWith("("));
  return parts.slice(0, 4).join("/") || file;
};

const byCommunity = new Map();
for (const n of graph.nodes) {
  if (n.community === undefined || n.community === null || !n.source_file) continue;
  const list = byCommunity.get(n.community) ?? [];
  list.push(n);
  byCommunity.set(n.community, list);
}

const labels = {};
const used = new Set();
for (const [id, nodes] of [...byCommunity].sort((a, b) => a[0] - b[0])) {
  const folders = new Map();
  for (const n of nodes) folders.set(folderOf(n.source_file), (folders.get(folderOf(n.source_file)) ?? 0) + 1);
  const [folder] = [...folders].sort((a, b) => b[1] - a[1])[0];
  const hub = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
  let label = `${folder} · ${hub.label}`;
  for (let i = 2; used.has(label); i++) label = `${folder} · ${hub.label} (${i})`;
  used.add(label);
  labels[String(id)] = label;
}

fs.writeFileSync(path.join(OUT, ".graphify_labels.json"), JSON.stringify(labels, null, 2) + "\n");
console.log(`Named ${Object.keys(labels).length} communities in graphify-out/.graphify_labels.json`);
