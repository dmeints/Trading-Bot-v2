import { test, expect } from '@playwright/test';

test.describe('AI Logs Page Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  });

  test('AI logs page layout - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Wait for log entries to load
    await page.waitForSelector('[data-testid="log-entry"]', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot('ai-logs-desktop.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('AI logs scrolling functionality', async ({ page }) => {
    const logContainer = page.locator('[data-testid="logs-container"]');
    
    if (await logContainer.isVisible()) {
      // Test scrolling to bottom
      await logContainer.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      
      await page.waitForTimeout(500);
      await expect(logContainer).toHaveScreenshot('logs-scrolled-bottom.png');
    }
  });

  test('Log filtering functionality', async ({ page }) => {
    // Test log level filtering if available
    const filterButton = page.locator('[data-testid="filter-error"]');
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('logs-filtered-error.png', {
        fullPage: true,
        threshold: 0.2,
      });
    }
  });
});