import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard page accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid*="price"]', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Trading page accessibility', async ({ page }) => {
    await page.goto('/trading');
    
    await page.waitForSelector('[data-testid="trading-interface"]', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Portfolio page accessibility', async ({ page }) => {
    await page.goto('/portfolio');
    
    await page.waitForSelector('[data-testid="portfolio-container"]', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Analytics page accessibility', async ({ page }) => {
    await page.goto('/analytics');
    
    await page.waitForSelector('[data-testid="analytics-container"]', { timeout: 15000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('AI Insights page accessibility', async ({ page }) => {
    await page.goto('/ai-insights');
    
    await page.waitForSelector('[data-testid="ai-insights-container"]', { timeout: 15000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.locator(':focus').first();
      
      // Check that focused element is visible and interactive
      if (await focusedElement.count() > 0) {
        await expect(focusedElement).toBeVisible();
        
        // Check for proper focus indicators
        const styles = await focusedElement.evaluate(el => {
          const computedStyle = window.getComputedStyle(el);
          return {
            outline: computedStyle.outline,
            outlineWidth: computedStyle.outlineWidth,
            boxShadow: computedStyle.boxShadow,
          };
        });
        
        // Should have some form of focus indicator
        const hasFocusIndicator = 
          styles.outline !== 'none' || 
          styles.outlineWidth !== '0px' ||
          styles.boxShadow !== 'none';
          
        expect(hasFocusIndicator).toBeTruthy();
      }
    }
  });

  test('Screen reader landmarks are present', async ({ page }) => {
    await page.goto('/');
    
    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toHaveCount.greaterThanOrEqual(1);
    
    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
    }
    
    // Check for proper heading hierarchy
    const h1 = page.locator('h1');
    if (await h1.count() > 0) {
      await expect(h1.first()).toBeVisible();
    }
  });

  test('Color contrast meets WCAG standards', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('[data-testid]') // Focus on our interactive elements
      .analyze();

    // Filter for color contrast violations specifically
    const contrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('Form accessibility', async ({ page }) => {
    await page.goto('/trading');
    
    // Wait for trading form to load
    await page.waitForSelector('[data-testid="trading-interface"]', { timeout: 10000 });
    
    // Check for form labels
    const formInputs = page.locator('input, select, textarea');
    const inputCount = await formInputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = formInputs.nth(i);
      const inputId = await input.getAttribute('id');
      const inputName = await input.getAttribute('name');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      // Check if input has proper labeling
      if (inputId) {
        const label = page.locator(`label[for="${inputId}"]`);
        const hasLabel = await label.count() > 0;
        const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;
        
        // Input should have either a label or aria-label
        expect(hasLabel || hasAriaLabel).toBeTruthy();
      }
    }
    
    // Run specific form accessibility checks
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('form, [role="form"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Live regions for dynamic content', async ({ page }) => {
    await page.goto('/');
    
    // Check for live regions that would announce price updates
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const liveRegionCount = await liveRegions.count();
    
    if (liveRegionCount > 0) {
      for (let i = 0; i < liveRegionCount; i++) {
        const region = liveRegions.nth(i);
        await expect(region).toBeAttached();
        
        // Check aria-live values are valid
        const ariaLive = await region.getAttribute('aria-live');
        if (ariaLive) {
          expect(['polite', 'assertive', 'off']).toContain(ariaLive);
        }
      }
    }
  });

  test('Touch target size compliance', async ({ page }) => {
    await page.goto('/');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check touch targets (buttons, links) are at least 44x44px
    const interactiveElements = page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]');
    const elementCount = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(elementCount, 20); i++) { // Check first 20 elements
      const element = interactiveElements.nth(i);
      
      if (await element.isVisible()) {
        const boundingBox = await element.boundingBox();
        
        if (boundingBox) {
          // WCAG recommends minimum 44x44px touch targets
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('Error messages are accessible', async ({ page }) => {
    await page.goto('/trading');
    
    // Wait for trading interface
    await page.waitForSelector('[data-testid="trading-interface"]', { timeout: 10000 });
    
    // Look for any error messages that might be present
    const errorMessages = page.locator('[role="alert"], .error, [aria-live="assertive"]');
    const errorCount = await errorMessages.count();
    
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const error = errorMessages.nth(i);
        
        // Error should be visible and have appropriate role
        await expect(error).toBeVisible();
        
        const role = await error.getAttribute('role');
        const ariaLive = await error.getAttribute('aria-live');
        
        // Should have alert role or assertive live region
        const isAccessibleError = role === 'alert' || ariaLive === 'assertive';
        expect(isAccessibleError).toBeTruthy();
      }
    }
  });
});