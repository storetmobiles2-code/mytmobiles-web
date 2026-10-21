import { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD, signInAsAdmin } from "./fixtures";

/**
 * Complaint handling (Consumer Protection (E-Commerce) Rules, 2020): a guest
 * files a complaint and gets a ticket number, tracks it with ticket + email,
 * then an admin resolves it and the resolution shows on the tracking view.
 */
test.describe.serial("grievances", () => {
  const email = `e2e-grv+${Date.now()}@example.com`;
  let ticket = "";

  async function track(page: import("@playwright/test").Page, withEmail: string) {
    await page.goto(`/help/grievance?ticket=${ticket}`);
    await expect(page.getByLabel("Ticket number")).toHaveValue(ticket);
    await page.getByLabel("Email used for the complaint").fill(withEmail);
    await page.getByRole("button", { name: "Track complaint" }).click();
  }

  test("guest files a complaint and gets a ticket number", async ({ page }) => {
    await page.goto("/help/grievance");
    await expect(page.getByRole("heading", { level: 1, name: "Complaints & grievances" })).toBeVisible();
    await expect(page.getByText(/within 48 hours/).first()).toBeVisible();

    // Validation runs before anything is saved.
    await page.getByRole("button", { name: "File complaint" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();

    await page.getByLabel("Full name").fill("E2E Complainant");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/Mobile number/).fill("9876543210");
    await page.getByLabel("What is it about?").selectOption("DELIVERY");
    await page.getByLabel("Your complaint").fill("The courier marked my parcel delivered but I never received it.");
    await page.getByRole("button", { name: "File complaint" }).click();

    const shown = page.getByTestId("grievance-ticket");
    await expect(shown).toHaveText(/^GRV-\d{4}-\d{6,}$/);
    ticket = (await shown.textContent())!.trim();
    await expect(page.getByText(/within 48 hours\)/)).toBeVisible();
    await expect(page.getByText(/within one month\)/)).toBeVisible();
  });

  test("the complaint can be tracked only with the matching email", async ({ page }) => {
    test.skip(!ticket, "needs the ticket from the previous test");
    await track(page, "someone-else@example.com");
    await expect(page.getByText(/couldn't find a complaint/)).toBeVisible();
    await expect(page.getByTestId("grievance-status")).toHaveCount(0);

    await track(page, email);
    const status = page.getByTestId("grievance-status");
    await expect(status).toContainText(ticket);
    await expect(status).toContainText("Open");
    await expect(status).toContainText(`Complaint received. Ticket ${ticket}.`);
    // Contact details and the message itself are never shown on the tracking view.
    await expect(status).not.toContainText("9876543210");
    await expect(status).not.toContainText("courier marked my parcel");
  });

  test("admin resolves the complaint and the customer sees the resolution", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL/ADMIN_PASSWORD (or E2E_ADMIN_*)");
    test.skip(!ticket, "needs the ticket from the first test");

    await signInAsAdmin(page, "/admin/grievances");
    await expect(page.getByRole("heading", { name: "Grievances" })).toBeVisible();

    await page.goto(`/admin/grievances?q=${ticket}`);
    await page.getByRole("link", { name: ticket }).click();
    await expect(page.getByRole("heading", { name: `Complaint ${ticket}` })).toBeVisible();

    // Resolving needs a resolution note.
    await page.getByLabel("Status").selectOption("RESOLVED");
    const resolution = "We traced the parcel with the courier and delivered it on 16 October.";
    await page.getByLabel(/Resolution \(emailed/).fill(resolution);
    await page.getByRole("button", { name: "Save and notify customer" }).click();
    await expect(page.getByText(/^Saved/)).toBeVisible();
    await expect(page.getByText("Resolution sent to the customer")).toBeVisible();
    await expect(page.getByText("Status changed to resolved.", { exact: false }).first()).toBeVisible();

    await page.context().clearCookies();
    await track(page, email);
    const status = page.getByTestId("grievance-status");
    await expect(status).toContainText("Resolved");
    await expect(status).toContainText(resolution);
  });
});
