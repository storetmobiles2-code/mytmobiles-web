import type { Page } from "@playwright/test";
import { expect, PRODUCT_SLUG, signInAsAdmin as signInWith2fa } from "./fixtures";

/**
 * Shared steps from the checkout flow in checkout.spec.ts. Each places a real
 * order and uses stock, so run only against a disposable database.
 */

/** Registers a new shopper, saves a Hyderabad address and places a Cash on Delivery order. Returns the order number. */
export async function placeCodOrder(page: Page): Promise<string> {
  await page.goto(`/p/${PRODUCT_SLUG}`);
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByText(/Added/).first()).toBeVisible();

  await page.goto("/cart");
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
  await page.getByRole("link", { name: "View order" }).click();
  const heading = page.getByRole("heading", { name: /Order MYT-/ });
  await expect(heading).toBeVisible();
  return (await heading.textContent())!.match(/MYT-[\w-]+/)![0];
}

export async function signInAsAdmin(page: Page) {
  await signInWith2fa(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

/** Packs and ships an order from the admin panel, which issues its tax invoice. Returns the invoice number. */
export async function packAndShip(page: Page, orderNumber: string): Promise<string> {
  await page.goto(`/admin/orders?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).first().click();
  await expect(page.getByRole("heading", { name: new RegExp(orderNumber) })).toBeVisible();
  await page.getByRole("button", { name: "Mark packed" }).click();
  await expect(page.getByLabel("Courier name")).toBeVisible();
  await page.getByLabel("Courier name").fill("Delhivery");
  await page.getByLabel("Tracking number").fill("E2E123456");
  await page.getByRole("button", { name: "Mark shipped" }).click();
  const invoice = page.getByRole("link", { name: /Invoice MYT\// });
  await expect(invoice).toBeVisible();
  return (await invoice.textContent())!.match(/MYT\/\d{4}\/\d+/)![0];
}
