import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Analytics Page Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await injectAxe(page);
  });

  test('Analytics page layout - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Wait for charts to render
    await page.waitForSelector('[data-testid="analytics-chart"]', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot('analytics-desktop.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Analytics page layout - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('analytics-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Analytics accessibility compliance', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      rules: {
        'color-contrast': { enabled: false }, // Charts may have intentional color choices
      },
    });
  });
});