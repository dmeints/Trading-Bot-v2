import AxeBuilder from "@axe-core/playwright";
import { expect, Page } from "@playwright/test";

export async function runA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter(v => ["serious","critical"].includes(v.impact || ""));
  expect(severe, JSON.stringify(severe, null, 2)).toHaveLength(0);
}