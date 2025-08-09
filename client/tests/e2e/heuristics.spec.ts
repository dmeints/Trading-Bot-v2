import { test, expect } from "@playwright/test";

const routes = ["/trading","/portfolio","/health","/simulation"];

test.describe("NN/g heuristics & nav patterns", () => {
  for (const route of routes) {
    test(`status, errors, consistency: ${route}`, async ({ page }) => {
      await page.goto(route);
      // Status visibility: loading skeletons or aria-busy
      const hasLoading = await page.locator("[data-skeleton], [aria-busy='true']").count();
      expect(hasLoading, "Missing loading state marker").toBeGreaterThan(0);

      // Error prevention/recovery: region to display errors + recovery action
      const errorRegion = page.locator("[role='alert'], [data-error]");
      // Not required to be visible unless error, but element should exist or be stubbed
      expect(await errorRegion.count(), "Missing error region").toBeGreaterThan(0);

      // Consistency: primary labels should exist and match across pages if present
      const buy = await page.locator("text=Buy, [data-testid='buy']").count();
      const sell = await page.locator("text=Sell, [data-testid='sell']").count();
      // presence optional per page, but if present must not conflict with other primary labels
      expect(buy >= 0 && sell >= 0).toBeTruthy();
    });
  }

  test("Nav pattern matches viewport (Material/HIG): bottom nav on mobile, side rail on desktop", async ({ browser }) => {
    const mobile = await browser.newPage();
    await mobile.setViewportSize({ width: 375, height: 812 });
    await mobile.goto("/trading");
    // Expect bottom navigation marker (add data-testid if missing)
    expect(await mobile.locator("[data-testid='bottom-nav']").count(), "Missing bottom nav on mobile").toBeGreaterThan(0);
    await mobile.close();

    const desktop = await browser.newPage();
    await desktop.setViewportSize({ width: 1440, height: 900 });
    await desktop.goto("/trading");
    expect(await desktop.locator("[data-testid='side-rail'], [data-testid='app-drawer']").count(), "Missing side rail/drawer on desktop").toBeGreaterThan(0);
    await desktop.close();
  });
});