import { test, expect, PRODUCT_SLUG, ADMIN_EMAIL, ADMIN_PASSWORD } from "./fixtures";

/**
 * The full purchase path: guest cart → register (cart merges) → address with
 * pincode lookup → Cash on Delivery → confirmation → admin packs, ships and
 * delivers → GST invoice. Places a real order and uses 1 unit of stock.
 */
test.describe.serial("checkout and fulfilment", () => {
  let orderNumber = "";

  test("guest can buy with Cash on Delivery after registering", async ({ page }) => {
    await page.goto(`/p/${PRODUCT_SLUG}`);
    const productName = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(page.getByText(/Added/).first()).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText(productName).first()).toBeVisible();
    await page.getByRole("link", { name: /Sign in to checkout/ }).click();
    await page.waitForURL(/\/login/);

    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("E2E Buyer");
    await page.getByLabel("Email", { exact: true }).fill(`e2e+${Date.now()}@example.com`);
    await page.getByLabel(/Mobile number/).fill("9876543210");
    await page.getByLabel("Password", { exact: true }).fill("secret123A");
    await page.getByLabel(/I agree/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL((u) => u.pathname === "/checkout", { timeout: 30_000 });

    // The guest cart was merged into the new account.
    await expect(page.getByText(productName).first()).toBeVisible();

    await page.getByLabel("Full name").fill("E2E Buyer");
    await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
    await page.getByLabel("Pincode").fill("500081");
    await page.getByLabel("Pincode").blur();
    await page.getByLabel(/Flat \/ House/).fill("Flat 101, Test Residency, Road 5");
    await page.getByLabel(/City/).fill("Hyderabad");
    await page.getByLabel("State").selectOption("Telangana");
    await page.getByRole("button", { name: "Save and deliver here" }).click();
    await expect(page.getByText(/Delivery by/).first()).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Cash on Delivery/).check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.waitForURL(/\/order-confirmation\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Your order is confirmed/ })).toBeVisible();

    await page.getByRole("link", { name: "View order" }).click();
    const heading = page.getByRole("heading", { name: /Order MYT-/ });
    await expect(heading).toBeVisible();
    orderNumber = (await heading.textContent())!.match(/MYT-[\w-]+/)![0];

    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("admin packs, ships and delivers the order and issues an invoice", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL/ADMIN_PASSWORD (or E2E_ADMIN_*)");
    test.skip(!orderNumber, "needs the order from the previous test");

    await page.goto("/login?next=/admin");
    await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto(`/admin/orders?q=${orderNumber}`);
    await page.getByRole("link", { name: orderNumber }).first().click();
    await expect(page.getByRole("heading", { name: new RegExp(orderNumber) })).toBeVisible();

    await page.getByRole("button", { name: "Mark packed" }).click();
    await expect(page.getByLabel("Courier name")).toBeVisible();
    await page.getByLabel("Courier name").fill("Delhivery");
    await page.getByLabel("Tracking number").fill("E2E123456");
    await page.getByRole("button", { name: "Mark shipped" }).click();
    await expect(page.getByRole("button", { name: "Mark delivered" })).toBeVisible();
    await page.getByRole("button", { name: "Mark delivered" }).click();

    const invoice = page.getByRole("link", { name: /Invoice MYT\// });
    await expect(invoice).toBeVisible();
    // Opens in a new tab in the UI; follow the link directly.
    await page.goto((await invoice.getAttribute("href"))!);
    await expect(page.getByRole("heading", { name: "TAX INVOICE" })).toBeVisible();
    await expect(page.getByText(/GSTIN|HSN/).first()).toBeVisible();
  });

  test("admin pages load", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL/ADMIN_PASSWORD (or E2E_ADMIN_*)");
    await page.goto("/login?next=/admin");
    await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    for (const path of ["/admin/orders", "/admin/products", "/admin/products/new", "/admin/inventory", "/admin/coupons", "/admin/banners", "/admin/categories", "/admin/customers", "/admin/reviews", "/admin/analytics", "/admin/settings"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
});
