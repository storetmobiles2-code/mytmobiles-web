/** "## Group" headings followed by "Label: Value" lines. */
export function parseSpecs(text: string) {
  const groups: { group: string; items: { label: string; value: string }[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("##")) groups.push({ group: line.replace(/^#+\s*/, ""), items: [] });
    else {
      const i = line.indexOf(":");
      if (i <= 0) continue;
      if (!groups.length) groups.push({ group: "Specifications", items: [] });
      groups[groups.length - 1].items.push({ label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    }
  }
  return groups.filter((g) => g.items.length);
}
