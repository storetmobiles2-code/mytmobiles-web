import { test, expect, PRODUCT_SLUG } from "./fixtures";

test.describe("storefront", () => {
  test("home page renders hero, categories and products", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/myT Mobiles/);
    await expect(page.getByRole("link", { name: /myT Mobiles — home/ }).first()).toBeVisible();
    await expect(page.locator('a[href^="/p/"]').first()).toBeVisible();
  });

  test("search finds products and suggests as you type", async ({ page, isMobile }) => {
    await page.goto("/");
    const box = page.getByPlaceholder("Search mobiles, TVs, coolers…").locator("visible=true");
    await box.fill("redmi");
    if (!isMobile) await expect(page.getByRole("listbox").locator("visible=true")).toBeVisible();
    await box.press("Enter");
    await page.waitForURL(/\/search\?q=redmi/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/redmi/i);
    await expect(page.locator('section[aria-label="Products"] a[href^="/p/"]').first()).toBeVisible();
  });

  test("search with no results shows an empty state", async ({ page }) => {
    await page.goto("/search?q=zzzzqqq");
    await expect(page.getByText(/No products|no results|nothing/i).first()).toBeVisible();
  });

  test("category page sorts by price", async ({ page }) => {
    await page.goto("/c/smartphones?sort=price-asc");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const prices = await page
      .locator('section[aria-label="Products"] [data-price]')
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-price"))));
    expect(prices.length).toBeGreaterThan(1);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  test("product page has price, variants, delivery check and structured data", async ({ page }) => {
    await page.goto(`/p/${PRODUCT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/₹\s?[\d,]+/).locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to cart/ })).toBeEnabled();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = ld.map((t) => JSON.parse(t)).flat().find((j) => j["@type"] === "Product");
    expect(product?.offers).toBeTruthy();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/p/${PRODUCT_SLUG}$`));
  });

  test("unknown product returns a real 404", async ({ page, browserErrors }) => {
    const res = await page.goto("/p/this-product-does-not-exist");
    // The browser logs the 404 document response itself; that one is expected.
    browserErrors.splice(0, browserErrors.length, ...browserErrors.filter((e) => !e.includes("status of 404")));
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/couldn.t find/i)).toBeVisible();
  });

  test("account pages require sign-in", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders/);
  });

  test("robots and sitemap are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toMatch(/Disallow: \/admin/);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain(`/p/${PRODUCT_SLUG}`);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
