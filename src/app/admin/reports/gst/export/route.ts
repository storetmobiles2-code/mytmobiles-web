import { assertAdmin, AuthError } from "@/lib/auth/guards";
import { gstr1Files, gstr1Readme, parseMonth } from "@/lib/reports/gstr1";
import { loadGstr1Report } from "@/lib/reports/gstr1-data";
import { createZip } from "@/lib/reports/zip";

/**
 * GSTR-1 download for one month: `?month=2026-10` returns a ZIP of CSVs;
 * add `&file=b2cs.csv` (or any other file in the ZIP) for a single CSV.
 */
export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (err) {
    if (err instanceof AuthError) return new Response("Not authorised.", { status: 401, headers: { "cache-control": "no-store" } });
    throw err;
  }

  const url = new URL(req.url);
  const month = parseMonth(url.searchParams.get("month"));
  const { report, store } = await loadGstr1Report(month);
  const files = gstr1Files(report, store);
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

  const wanted = url.searchParams.get("file");
  if (wanted) {
    const file = files.find((f) => f.name === wanted);
    if (!file) return new Response("Unknown file.", { status: 404, headers });
    return new Response(file.content, {
      headers: {
        ...headers,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="gstr1-${month.key}-${file.name}"`,
      },
    });
  }

  const zip = createZip([...files, { name: "README.txt", content: gstr1Readme(report, store) }].map((f) => ({ name: f.name, data: f.content })));
  return new Response(new Uint8Array(zip), {
    headers: {
      ...headers,
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="gstr1-${month.key}.zip"`,
    },
  });
}
