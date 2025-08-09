import { test, expect } from "@playwright/test";
import { runA11y } from "./axe";

const routes = ["/trading", "/portfolio", "/health", "/simulation"]; // Core routes from inventory

test.describe("UI/UX route smoke", () => {
  for (const route of routes) {
    test(`loads cleanly: ${route}`, async ({ page }) => {
      const errors: any[] = [];
      page.on("console", (msg) => {
        const type = msg.type();
        if (type === "error" || type === "warning") errors.push({ type, text: msg.text() });
      });

      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
      await runA11y(page);

      // Basic interaction sampling
      const buttons = page.locator("button:visible");
      const links = page.locator("a[href]:visible");
      await buttons.first().scrollIntoViewIfNeeded().catch(()=>{});
      const max = 5;
      for (const loc of [buttons, links]) {
        const n = Math.min(await loc.count(), max);
        for (let i = 0; i < n; i++) {
          const el = loc.nth(i);
          const before = page.url();
          await Promise.all([page.waitForLoadState("networkidle").catch(()=>{}), el.click().catch(()=>{})]);
          const after = page.url();
          if (after === before) {
            // Look for visible feedback
            const changed = await page.locator("[role='status'], [data-sonner-toast], [role='dialog']").count();
            if (!changed) console.log(`No visible effect for click ${i} on ${route} (check data-testids/pending states).`);
          }
        }
      }

      expect(errors.filter(e => e.type === "error")).toHaveLength(0);
    });
  }
});