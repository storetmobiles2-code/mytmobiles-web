import AxeBuilder from "@axe-core/playwright";
import { test, expect, PRODUCT_SLUG } from "./fixtures";

/** WCAG 2.1 A/AA checks with axe-core on the main shopper-facing pages. */
const PAGES = ["/", `/p/${PRODUCT_SLUG}`, "/c/smartphones", "/search?q=samsung", "/cart", "/login", "/register", "/offers", "/help/returns"];

for (const path of PAGES) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(" ")}`);
    expect(summary).toEqual([]);
  });
}
