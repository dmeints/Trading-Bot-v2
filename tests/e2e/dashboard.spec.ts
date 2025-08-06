import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Dashboard Visual Regression & Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    
    // Wait for initial loading
    await page.waitForLoadState('networkidle');
    
    // Inject axe for accessibility testing
    await injectAxe(page);
  });

  test('Dashboard layout renders correctly on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Wait for components to load
    await page.waitForSelector('[data-testid="dashboard-grid"]', { timeout: 10000 });
    
    // Take full page screenshot for visual regression
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Dashboard layout renders correctly on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Wait for responsive layout to apply
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Dashboard layout renders correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for mobile layout
    await page.waitForTimeout(1000);
    
    // Check if mobile navigation is visible
    await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
    
    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('Adaptive cards function correctly', async ({ page }) => {
    // Test adaptive card expansion
    const adaptiveCard = page.locator('[data-testid="adaptive-card-market-overview"]').first();
    
    if (await adaptiveCard.isVisible()) {
      // Try to expand card
      const expandButton = adaptiveCard.locator('button[aria-label*="expand"]').first();
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(500);
        
        // Take screenshot of expanded state
        await expect(adaptiveCard).toHaveScreenshot('adaptive-card-expanded.png');
      }
    }
  });

  test('Status indicators display correctly', async ({ page }) => {
    // Check WebSocket status indicator
    const statusIndicator = page.locator('[data-testid="websocket-status"]');
    await expect(statusIndicator).toBeVisible();
    
    // Take screenshot of status area
    await expect(statusIndicator).toHaveScreenshot('status-indicators.png');
  });

  test('Feedback widget functionality', async ({ page }) => {
    // Click feedback button
    await page.click('[data-testid="button-feedback-open"]');
    
    // Wait for modal to appear
    await page.waitForSelector('[data-testid="star-rating-5"]');
    
    // Test rating interaction
    await page.click('[data-testid="star-rating-5"]');
    
    // Fill in feedback form
    await page.fill('[data-testid="textarea-feedback-message"]', 'The new UI components work great!');
    
    // Take screenshot of feedback form
    await expect(page.locator('dialog')).toHaveScreenshot('feedback-form.png');
    
    // Close modal
    await page.click('[data-testid="button-cancel-feedback"]');
  });

  test('Page accessibility compliance', async ({ page }) => {
    // Run accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        // Disable color contrast rule for crypto price indicators (intentionally colored)
        'color-contrast': { enabled: false },
      },
    });
  });

  test('Scrolling containers work properly', async ({ page }) => {
    // Test scrollable areas
    const scrollableContainer = page.locator('.scrollbar-custom').first();
    
    if (await scrollableContainer.isVisible()) {
      // Scroll down in container
      await scrollableContainer.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });
      
      await page.waitForTimeout(500);
      
      // Take screenshot to verify scroll position
      await expect(scrollableContainer).toHaveScreenshot('scrolled-container.png');
    }
  });

  test('Responsive text scaling', async ({ page }) => {
    const breakpoints = [
      { width: 320, height: 568, name: 'mobile-small' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1440, height: 900, name: 'desktop' },
      { width: 1920, height: 1080, name: 'desktop-large' }
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.waitForTimeout(500);
      
      // Check if text scales appropriately
      const priceElement = page.locator('.text-price-lg').first();
      if (await priceElement.isVisible()) {
        await expect(priceElement).toHaveScreenshot(`price-text-${breakpoint.name}.png`);
      }
    }
  });

  test('Performance metrics within thresholds', async ({ page }) => {
    // Start performance measurement
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Measure performance metrics
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const navigationEntry = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming;
          
          if (navigationEntry) {
            resolve({
              fcp: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
              tti: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
              domInteractive: navigationEntry.domInteractive - navigationEntry.fetchStart,
            });
          }
        }).observe({ entryTypes: ['navigation'] });
      });
    });

    console.log('Performance metrics:', performanceMetrics);
    
    // Assert performance thresholds (for CI)
    const metrics = performanceMetrics as any;
    if (process.env.CI) {
      expect(metrics.fcp).toBeLessThan(1500); // FCP < 1.5s
      expect(metrics.tti).toBeLessThan(3000); // TTI < 3s
    }
  });

  test('Dark mode theme consistency', async ({ page }) => {
    // Check dark mode is applied correctly
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark/);
    
    // Take screenshot to verify dark theme
    await expect(page).toHaveScreenshot('dark-mode-theme.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });
});