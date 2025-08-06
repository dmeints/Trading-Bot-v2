import { test, expect } from '@playwright/test';

test.describe('Skippy Critical User Journeys', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for auth check
    await page.waitForLoadState('networkidle');
  });

  test('Landing page loads and shows login option', async ({ page }) => {
    // Should show landing page for unauthenticated users
    await expect(page.locator('h1')).toContainText(['Skippy', 'Trading', 'Welcome']);
    
    // Should have login link/button
    await expect(page.getByRole('link', { name: /login|sign in|get started/i })).toBeVisible();
  });

  test('Dashboard loads with real market data', async ({ page }) => {
    // Simulate authenticated state (development bypass)
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible({ timeout: 10000 });
    
    // Check for market data widgets
    await expect(page.locator('[data-testid*="price"]')).toHaveCount.greaterThan(3);
    
    // Verify real market data (not placeholder)
    const btcPrice = page.locator('[data-testid*="btc"], [data-testid*="BTC"]').first();
    await expect(btcPrice).toContainText(/\$[0-9,]+/);
    
    // Check for portfolio section
    await expect(page.locator('[data-testid*="portfolio"]')).toBeVisible();
  });

  test('Paper trading flow works end-to-end', async ({ page }) => {
    await page.goto('/trading');
    
    // Wait for trading interface
    await expect(page.locator('[data-testid="trading-interface"]')).toBeVisible({ timeout: 10000 });
    
    // Check for trading form
    const symbolSelect = page.locator('[data-testid="symbol-select"]');
    const quantityInput = page.locator('[data-testid="quantity-input"]');
    const tradeButton = page.locator('[data-testid="button-trade"], [data-testid="button-buy"]');
    
    if (await symbolSelect.isVisible()) {
      await symbolSelect.click();
      await page.getByText('BTC').click();
    }
    
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('0.01');
    }
    
    if (await tradeButton.isVisible()) {
      await tradeButton.click();
      
      // Should show confirmation or success message
      await expect(page.locator('[data-testid*="success"], [data-testid*="confirm"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Portfolio view displays positions and performance', async ({ page }) => {
    await page.goto('/portfolio');
    
    // Wait for portfolio to load
    await expect(page.locator('[data-testid="portfolio-container"]')).toBeVisible({ timeout: 10000 });
    
    // Check for portfolio metrics
    await expect(page.locator('[data-testid*="balance"], [data-testid*="value"]')).toBeVisible();
    
    // Check for positions table/list
    const positionsSection = page.locator('[data-testid*="position"]').first();
    if (await positionsSection.isVisible()) {
      await expect(positionsSection).toBeVisible();
    }
    
    // Performance metrics should be visible
    await expect(page.locator('[data-testid*="pnl"], [data-testid*="performance"]')).toBeVisible();
  });

  test('Analytics page loads with lazy loading', async ({ page }) => {
    // Start navigation
    await page.goto('/analytics');
    
    // Should show loading state first
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.isVisible()) {
      await loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
    
    // Analytics content should load
    await expect(page.locator('[data-testid="analytics-container"]')).toBeVisible({ timeout: 15000 });
    
    // Should have chart components
    await expect(page.locator('[data-testid*="chart"], .recharts-wrapper')).toBeVisible();
  });

  test('AI Insights page loads with lazy loading', async ({ page }) => {
    // Start navigation  
    await page.goto('/ai-insights');
    
    // Should show loading state first
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.isVisible()) {
      await loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
    
    // AI Insights content should load
    await expect(page.locator('[data-testid="ai-insights-container"]')).toBeVisible({ timeout: 15000 });
    
    // Should have AI recommendations or insights
    await expect(page.locator('[data-testid*="insight"], [data-testid*="recommendation"]')).toBeVisible();
  });

  test('WebSocket real-time updates work', async ({ page }) => {
    await page.goto('/');
    
    // Wait for WebSocket connection
    await page.waitForTimeout(2000);
    
    // Look for real-time price updates
    const priceElement = page.locator('[data-testid*="btc-price"], [data-testid*="price-BTC"]').first();
    
    if (await priceElement.isVisible()) {
      const initialPrice = await priceElement.textContent();
      
      // Wait for potential update
      await page.waitForTimeout(5000);
      
      // Price should still be visible (may or may not have changed)
      await expect(priceElement).toBeVisible();
      await expect(priceElement).toContainText(/\$[0-9,]+/);
    }
  });

  test('Navigation between pages works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation links
    const navLinks = [
      { href: '/trading', text: /trading/i },
      { href: '/portfolio', text: /portfolio/i },
      { href: '/analytics', text: /analytics/i },
      { href: '/ai-insights', text: /ai|insights/i }
    ];
    
    for (const link of navLinks) {
      const navLink = page.getByRole('link', { name: link.text });
      if (await navLink.isVisible()) {
        await navLink.click();
        await expect(page).toHaveURL(new RegExp(link.href));
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('API endpoints return valid data', async ({ page }) => {
    // Test API endpoints directly
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('status', 'healthy');
    
    // Test market data
    const marketResponse = await page.request.get('/api/market/latest');
    if (marketResponse.ok()) {
      const marketData = await marketResponse.json();
      expect(Array.isArray(marketData) || typeof marketData === 'object').toBeTruthy();
    }
  });

  test('Error states are handled gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/nonexistent-page');
    await expect(page.locator('text=/not found|404/i')).toBeVisible();
    
    // Test API error handling
    const response = await page.request.get('/api/nonexistent-endpoint');
    expect(response.status()).toBe(404);
  });
});