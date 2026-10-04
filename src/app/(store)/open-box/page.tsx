import type { Metadata } from "next";
import { parseFilters } from "@/lib/catalog/filters";
import { ListingView } from "@/components/listing/listing-view";

export const metadata: Metadata = {
  title: "Open-box Demo Units — Lower Prices",
  description: "Demo (display) units from the myT Mobiles store at lower prices. Limited pieces.",
  alternates: { canonical: "/open-box" },
};

export default async function OpenBoxPage(props: PageProps<"/open-box">) {
  return (
    <>
      <div className="container-page pt-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>About demo units:</strong> these were used for in-store display and may show light signs of handling. Returns are not accepted on demo units;
          manufacturing defects are handled as per the brand&apos;s warranty. Contact us before ordering for the exact condition and remaining warranty.
        </div>
      </div>
      <ListingView
        title="Open-box demo units"
        crumbs={[{ name: "Home", href: "/" }, { name: "Open-box deals" }]}
        basePath="/open-box"
        filters={parseFilters(await props.searchParams)}
        scope={{ condition: "DEMO" }}
        showConditionFilter={false}
      />
    </>
  );
}
