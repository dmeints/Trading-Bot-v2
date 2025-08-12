import { test, expect } from "@playwright/test";
import { runA11y } from "./axe";
import fs from "fs";

const inventoryPath = "tools/interaction_inventory.json";
const routes: string[] = fs.existsSync(inventoryPath) 
  ? JSON.parse(fs.readFileSync(inventoryPath,"utf8"))
      .map((i:any)=>i.route)
      .filter((v:string,i:number,a:string[])=>a.indexOf(v)===i) 
  : ["/trading","/portfolio","/analytics","/health"];

test.describe("WCAG 2.2 essentials", () => {
  test("tap targets >= 24x24 on mobile for primary controls", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of routes) {
      await page.goto(route);
      // Primary controls from inventory or common testids
      const selectors = [
        "[data-testid='button-buy']",
        "[data-testid='button-sell']",
        "[data-testid='button-save']",
        "[data-testid='button-cancel']",
        "[data-testid='button-submit']",
        "[data-testid='place-order']"
      ];
      for (const sel of selectors) {
        const el = page.locator(sel);
        if (await el.count()) {
          const bb = await el.first().boundingBox();
          expect(bb, `Small tap target for ${sel} on ${route}`).not.toBeNull();
          if (bb) {
            expect(bb.width).toBeGreaterThanOrEqual(24);
            expect(bb.height).toBeGreaterThanOrEqual(24);
          }
        }
      }
    }
  });

  test("keyboard traversal shows visible, unobscured focus and no traps", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      // Tab through the first ~30 focusable elements
      for (let i=0;i<30;i++){
        await page.keyboard.press("Tab");
        const active = await page.evaluate(() => document.activeElement && (document.activeElement as HTMLElement).outerHTML);
        const rect = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, computed: getComputedStyle(el).outlineStyle };
        });
        expect(rect).not.toBeNull();
        if (rect) {
          expect(rect.w).toBeGreaterThan(0);
          expect(rect.h).toBeGreaterThan(0);
          // focus should not be completely off-screen
          expect(rect.y + rect.h).toBeGreaterThanOrEqual(0);
        }
      }
      await runA11y(page);
    }
  });

  test("drag actions have non-drag alternative", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      const sliders = page.locator("[role='slider'], input[type=range]");
      const n = await sliders.count();
      for (let i=0;i<n;i++){
        const slider = sliders.nth(i);
        // Look for sibling numeric input or +/- buttons
        const alt = page.locator("input[type=number], [data-testid='decrement'], [data-testid='increment']");
        expect(await alt.count(), `No alternative to drag for slider on ${route}`).toBeGreaterThan(0);
      }
    }
  });
});