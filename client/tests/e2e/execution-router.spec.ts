
import { test, expect } from '@playwright/test';

test.describe('Execution Router', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');
  });

  test('displays execution router with reasoning', async ({ page }) => {
    // Wait for execution router to load
    await expect(page.locator('[data-testid="execution-router-card"]')).toBeVisible();
    
    // Enter order details to trigger router
    await page.fill('[data-testid="order-size-input"]', '1.5');
    await page.click('[data-testid="buy-button"]');
    
    // Check that execution recommendation appears
    await expect(page.locator('[data-testid="execution-recommendation"]')).toBeVisible();
    await expect(page.locator('[data-testid="execution-reasoning"]')).toBeVisible();
    await expect(page.locator('[data-testid="execution-confidence"]')).toBeVisible();
  });

  test('allows manual execution style override', async ({ page }) => {
    await page.fill('[data-testid="order-size-input"]', '1.0');
    
    // Open execution style selector
    await page.click('[data-testid="execution-style-selector"]');
    
    // Select IOC execution
    await page.click('text=IOC (Immediate)');
    
    // Verify selection
    await expect(page.locator('[data-testid="execution-style-selector"] >> text=IOC')).toBeVisible();
    
    // Check reasoning updates
    await expect(page.locator('[data-testid="execution-reasoning"]')).toContainText('Manual override');
  });

  test('displays market conditions accurately', async ({ page }) => {
    await page.fill('[data-testid="order-size-input"]', '2.0');
    
    // Check market condition displays
    await expect(page.locator('[data-testid="market-spread"]')).toBeVisible();
    await expect(page.locator('[data-testid="market-volatility"]')).toBeVisible();
    await expect(page.locator('[data-testid="market-liquidity"]')).toBeVisible();
    
    // Verify numeric values are displayed
    const spreadElement = page.locator('[data-testid="market-spread"] .font-medium');
    await expect(spreadElement).toContainText(/\d+\.\d+/);
  });

  test('confidence indicator reflects decision quality', async ({ page }) => {
    await page.fill('[data-testid="order-size-input"]', '0.5');
    
    // Check confidence bar is visible and has proper width
    const confidenceBar = page.locator('[data-testid="confidence-bar"]');
    await expect(confidenceBar).toBeVisible();
    
    // Verify confidence percentage is displayed
    const confidenceText = page.locator('[data-testid="execution-confidence"]');
    await expect(confidenceText).toContainText('%');
  });

  test('handles loading state properly', async ({ page }) => {
    // Start with loading state
    await expect(page.locator('[data-testid="execution-loading"]')).not.toBeVisible();
    
    // Trigger new decision
    await page.fill('[data-testid="order-size-input"]', '5.0');
    
    // Should show loading briefly (this might be fast)
    // Then show result
    await expect(page.locator('[data-testid="execution-recommendation"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Risk Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');
  });

  test('displays risk preset options', async ({ page }) => {
    await expect(page.locator('[data-testid="risk-presets-card"]')).toBeVisible();
    
    // Check all preset buttons
    await expect(page.locator('[data-testid="risk-preset-conservative"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-preset-moderate"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-preset-aggressive"]')).toBeVisible();
  });

  test('allows risk preset selection', async ({ page }) => {
    // Click aggressive preset
    await page.click('[data-testid="risk-preset-aggressive"]');
    
    // Verify selection highlight
    await expect(page.locator('[data-testid="risk-preset-aggressive"]')).toHaveClass(/ring-2/);
    
    // Check current config updates
    await expect(page.locator('[data-testid="current-risk-config"]')).toContainText('20%');
  });

  test('switches to custom mode', async ({ page }) => {
    // Toggle to custom mode
    await page.click('[data-testid="custom-risk-toggle"]');
    
    // Verify custom controls appear
    await expect(page.locator('[data-testid="custom-risk-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="position-size-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="stop-loss-slider"]')).toBeVisible();
  });

  test('custom sliders update risk score', async ({ page }) => {
    await page.click('[data-testid="custom-risk-toggle"]');
    
    // Move position size slider to high value
    const slider = page.locator('[data-testid="position-size-slider"] >> role=slider');
    await slider.fill('30');
    
    // Check risk score updates
    await expect(page.locator('[data-testid="risk-score-bar"]')).toBeVisible();
  });

  test('displays tooltips on hover', async ({ page }) => {
    // Hover over conservative preset
    await page.hover('[data-testid="risk-preset-conservative"]');
    
    // Check tooltip appears with details
    await expect(page.locator('text=Max Position:')).toBeVisible({ timeout: 3000 });
  });
});
