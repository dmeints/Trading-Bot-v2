import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard visual regression', async ({ page }) => {
    await page.goto('/');
    
    // Wait for market data to load
    await page.waitForSelector('[data-testid*="price"]', { timeout: 10000 });
    
    // Hide dynamic content that changes frequently
    await page.addStyleTag({
      content: `
        [data-testid*="price"] { opacity: 0.5 !important; }
        [data-testid*="timestamp"] { opacity: 0.5 !important; }
        .animate-spin { animation: none !important; }
      `
    });
    
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      threshold: 0.3 // Allow for minor differences in dynamic content
    });
  });

  test('Trading interface visual regression', async ({ page }) => {
    await page.goto('/trading');
    
    // Wait for trading interface to load
    await page.waitForSelector('[data-testid="trading-interface"]', { timeout: 10000 });
    
    // Hide dynamic price data
    await page.addStyleTag({
      content: `
        [data-testid*="price"] { opacity: 0.5 !important; }
        [data-testid*="market-data"] { opacity: 0.5 !important; }
      `
    });
    
    await expect(page.locator('[data-testid="trading-interface"]')).toHaveScreenshot('trading-interface.png', {
      threshold: 0.2
    });
  });

  test('Portfolio layout visual regression', async ({ page }) => {
    await page.goto('/portfolio');
    
    // Wait for portfolio to load
    await page.waitForSelector('[data-testid="portfolio-container"]', { timeout: 10000 });
    
    // Hide dynamic PnL values
    await page.addStyleTag({
      content: `
        [data-testid*="pnl"] { opacity: 0.5 !important; }
        [data-testid*="balance"] { opacity: 0.5 !important; }
      `
    });
    
    await expect(page.locator('[data-testid="portfolio-container"]')).toHaveScreenshot('portfolio-layout.png', {
      threshold: 0.2
    });
  });

  test('Analytics charts visual regression', async ({ page }) => {
    await page.goto('/analytics');
    
    // Wait for charts to render
    await page.waitForSelector('.recharts-wrapper', { timeout: 15000 });
    
    // Hide dynamic chart data but keep layout
    await page.addStyleTag({
      content: `
        .recharts-line { opacity: 0.3 !important; }
        .recharts-bar { opacity: 0.3 !important; }
      `
    });
    
    await expect(page.locator('[data-testid="analytics-container"]')).toHaveScreenshot('analytics-charts.png', {
      threshold: 0.4 // Charts have more variation
    });
  });

  test('AI Insights interface visual regression', async ({ page }) => {
    await page.goto('/ai-insights');
    
    // Wait for AI insights to load
    await page.waitForSelector('[data-testid="ai-insights-container"]', { timeout: 15000 });
    
    await expect(page.locator('[data-testid="ai-insights-container"]')).toHaveScreenshot('ai-insights-layout.png', {
      threshold: 0.2
    });
  });

  test('Mobile responsive - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    
    await page.waitForSelector('[data-testid*="price"]', { timeout: 10000 });
    
    // Hide dynamic content
    await page.addStyleTag({
      content: `
        [data-testid*="price"] { opacity: 0.5 !important; }
        [data-testid*="timestamp"] { opacity: 0.5 !important; }
      `
    });
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('Mobile responsive - Trading', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/trading');
    
    await page.waitForSelector('[data-testid="trading-interface"]', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot('trading-mobile.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('Dark theme consistency', async ({ page }) => {
    await page.goto('/');
    
    // Verify dark theme is applied
    const bodyBg = await page.locator('body').evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Should be dark (not white)
    expect(bodyBg).not.toBe('rgb(255, 255, 255)');
    
    await page.waitForSelector('[data-testid*="price"]', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot('dark-theme-consistency.png', {
      threshold: 0.2
    });
  });

  test('Accessibility - Focus indicators', async ({ page }) => {
    await page.goto('/trading');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Capture focus states
    await expect(page).toHaveScreenshot('focus-indicators.png', {
      threshold: 0.2
    });
  });
});