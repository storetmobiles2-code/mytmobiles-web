import AxeBuilder from "@axe-core/playwright";
import { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD } from "./fixtures";
import { packAndShip, placeCodOrder, signInAsAdmin } from "./helpers";

/** Current month in India, e.g. "2026-10". */
function istMonth(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
}

/**
 * Places a COD order, ships it so it gets a tax invoice, then checks that the
 * GSTR-1 report lists it and that the downloads work. Uses 1 unit of stock.
 */
test.describe.serial("GST (GSTR-1) report", () => {
  let orderNumber = "";

  test("shopper places a Cash on Delivery order", async ({ page }) => {
    orderNumber = await placeCodOrder(page);
  });

  test("admin sees the invoiced order in this month's report and downloads it", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL/ADMIN_PASSWORD (or E2E_ADMIN_*)");
    test.skip(!orderNumber, "needs the order from the previous test");
    const month = istMonth();

    await signInAsAdmin(page);
    const invoiceNumber = await packAndShip(page, orderNumber);

    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Reports" }).click();
    await page.getByRole("link", { name: /GST \(GSTR-1\)/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "GST (GSTR-1)" })).toBeVisible();
    await expect(page.getByLabel("Month")).toHaveValue(month);
    await expect(page.getByRole("cell", { name: orderNumber }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: invoiceNumber }).first()).toBeVisible();
    await expect(page.getByText("Taxable value").first()).toBeVisible();

    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

    // ZIP download through the button.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Download ZIP/ }).click()]);
    expect(download.suggestedFilename()).toBe(`gstr1-${month}.zip`);

    const zip = await page.request.get(`/admin/reports/gst/export?month=${month}`);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toBe("application/zip");
    const bytes = await zip.body();
    expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(bytes.includes(Buffer.from("register.csv"))).toBe(true);

    const register = await page.request.get(`/admin/reports/gst/export?month=${month}&file=register.csv`);
    expect(register.status()).toBe(200);
    expect(register.headers()["content-type"]).toContain("text/csv");
    const csv = (await register.body()).toString("utf8");
    expect(csv.startsWith("﻿Invoice No,Invoice Date,Customer,Buyer GSTIN,Place Of Supply,State Code,Supply Type,GSTR-1 Table,Rate,Taxable Value,IGST,CGST,SGST,Total,Invoice Value,Payment Method,Order No,Status\r\n")).toBe(true);
    expect(csv).toContain(orderNumber);
    expect(csv).toContain(invoiceNumber);

    const expected: Record<string, string> = {
      "b2cs.csv": "Type,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN",
      "b2cl.csv": "Invoice Number,Invoice date,Invoice Value,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN",
      "hsn_b2c.csv": "HSN,Description,UQC,Total Quantity,Total Value,Rate,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount,Cess Amount",
      "docs.csv": "Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled",
      "refunds.csv": "Order No,Invoice No,Invoice Date,Event,Event Date,Payment Method,Refund Status,Refund Amount,Place Of Supply,Taxable Value,IGST,CGST,SGST,Note",
    };
    for (const [file, header] of Object.entries(expected)) {
      const res = await page.request.get(`/admin/reports/gst/export?month=${month}&file=${file}`);
      expect(res.status(), file).toBe(200);
      expect((await res.body()).toString("utf8").split("\r\n")[0], file).toBe(`﻿${header}`);
    }
    const hsn = (await (await page.request.get(`/admin/reports/gst/export?month=${month}&file=hsn_b2c.csv`)).body()).toString("utf8");
    expect(hsn).toContain("NOS-NUMBERS");
  });

  test("the export needs an admin session", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.get(`/admin/reports/gst/export?month=${istMonth()}`);
    expect(res.status()).toBe(401);
    await anon.dispose();
  });
});
