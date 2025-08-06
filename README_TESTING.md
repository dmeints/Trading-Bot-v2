# Skippy UI Testing & Monitoring Guide

## Overview
This guide covers the comprehensive testing infrastructure and monitoring setup for the Skippy Trading Platform UI, including visual regression tests, accessibility audits, performance monitoring, and CI/CD pipeline configuration.

## Testing Infrastructure

### 1. Visual Regression Testing with Playwright

#### Setup
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

#### Running Tests
```bash
# Run all E2E tests
npx playwright test

# Run with UI mode for debugging
npx playwright test --ui

# Run only visual regression tests
npx playwright test --grep="Visual Regression"

# Run accessibility tests
npx playwright test --grep="accessibility"

# Run performance tests
npx playwright test --grep="Performance"
```

#### Test Coverage
- **Dashboard Layout**: Desktop, tablet, and mobile responsive layouts
- **Adaptive Cards**: Progressive disclosure and user level adaptations
- **Status Indicators**: Real-time connection and market status
- **Feedback Widget**: Modal functionality and form validation
- **Scrolling Containers**: Custom scrollbar behavior
- **Responsive Text**: Fluid typography scaling
- **Dark Mode**: Theme consistency across components

### 2. Accessibility Testing

#### Tools Used
- **axe-core**: Automated accessibility testing
- **@axe-core/playwright**: Playwright integration

#### Coverage
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast validation (excluding intentional crypto indicators)
- Focus management

#### Running A11y Tests
```bash
npx playwright test --grep="accessibility"
```

### 3. Performance Monitoring

#### Metrics Tracked
- **First Contentful Paint (FCP)**: Target < 1.5s
- **Time to Interactive (TTI)**: Target < 3s
- **DOM Interactive**: Measured for responsiveness

#### Lighthouse Integration
```bash
# Run Lighthouse audit manually
npx lighthouse http://localhost:5000 --chrome-flags="--headless" --output=json
```

#### CI Performance Thresholds
- Performance Score: ≥ 70%
- Accessibility Score: ≥ 90%
- Best Practices Score: ≥ 80%

### 4. Visual Diff Testing

#### How It Works
- Baseline screenshots captured for each component state
- Threshold: 0.2 (20% difference tolerance)
- Automatic failure on layout shifts > threshold
- Artifact uploads for failed tests

#### Key Test Areas
- **Multi-device Testing**: Phone, tablet, desktop, large desktop
- **Component States**: Default, expanded, collapsed, loading
- **User Interactions**: Hover states, active states, focus states
- **Data States**: Empty, loading, error, populated

## CI/CD Pipeline

### GitHub Actions Workflow

#### Jobs
1. **Lint & Test**: TypeScript checking, basic testing
2. **Visual Regression**: Screenshot comparison
3. **Lighthouse Audit**: Performance & accessibility scoring
4. **Accessibility Audit**: Comprehensive A11y testing
5. **Deploy Staging**: Automated staging deployment

#### Workflow Triggers
- Push to `main` or `develop` branches
- Pull requests to `main`

#### Artifact Storage
- Playwright reports: 30 days
- Visual diff failures: 7 days
- Lighthouse reports: 30 days
- Accessibility reports: 30 days

### Configuration Files

#### Playwright Config (`playwright.config.ts`)
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
})
```

## UI Components Testing

### 1. Adaptive Cards
- **Progressive Disclosure**: Beginner vs Expert view modes
- **Status Indicators**: Live, delayed, offline states
- **User Interactions**: Expand, collapse, minimize, maximize
- **Responsive Behavior**: Column span adjustments

### 2. Status Indicators
- **Connection Status**: Online, offline, connecting with animations
- **Data Freshness**: Timestamp tracking with staleness detection
- **Trading Status**: Market open/closed, active orders, connection state

### 3. Feedback Widget
- **Form Validation**: Required fields, input validation
- **User Interactions**: Star ratings, category selection
- **Modal Behavior**: Open, close, form submission
- **Error Handling**: Network failures, validation errors

### 4. Responsive Design
- **Breakpoints**: 320px, 768px, 1024px, 1440px, 1920px+
- **Grid Adaptation**: 1→2→3→4 column layouts
- **Text Scaling**: Fluid typography with clamp()
- **Spacing**: Fluid padding and margins

## Performance Optimization

### 1. CSS Optimizations
- **Custom Scrollbars**: Thin, always-visible for data tables
- **Fluid Typography**: Responsive text scaling
- **CSS Grid**: Modern layout with auto-fit/minmax
- **Animation Performance**: GPU-accelerated transforms

### 2. Component Optimizations
- **Lazy Loading**: AI services initialize on demand
- **Memoization**: Expensive calculations cached
- **Virtual Scrolling**: Large data sets (when implemented)

### 3. Bundle Optimization
- **Code Splitting**: Route-based chunks
- **Tree Shaking**: Unused code elimination
- **Compression**: Gzip/Brotli in production

## Monitoring & Alerting

### 1. Real-time Monitoring
- **WebSocket Status**: Connection health indicators
- **Market Data Freshness**: Timestamp-based staleness detection
- **AI Agent Status**: Multi-agent health monitoring

### 2. Error Tracking
- **Failed API Calls**: Network error handling
- **Component Errors**: Error boundaries with fallbacks
- **Performance Degradation**: Automatic alerts on threshold breaches

### 3. User Feedback Collection
- **In-app Widget**: 5-star rating with categorized feedback
- **Analytics Tracking**: Page performance and user interactions
- **A/B Testing**: Feature flag controlled experiments

## Extending the Test Suite

### Adding New Visual Tests
1. Create test file in `tests/e2e/`
2. Use `await expect(page).toHaveScreenshot('test-name.png')`
3. Run test locally to generate baseline
4. Commit baseline screenshots

### Adding Accessibility Tests
```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('Component accessibility', async ({ page }) => {
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    rules: {
      'color-contrast': { enabled: false }, // If needed
    },
  });
});
```

### Adding Performance Tests
```typescript
test('Performance thresholds', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        // Extract timing metrics
        resolve(metrics);
      }).observe({ entryTypes: ['navigation'] });
    });
  });
  
  expect(metrics.fcp).toBeLessThan(1500);
  expect(metrics.tti).toBeLessThan(3000);
});
```

## Troubleshooting

### Common Issues

#### Visual Test Failures
1. Check browser versions match CI environment
2. Verify screenshot differences in test artifacts
3. Update baselines if changes are intentional

#### Accessibility Violations
1. Review axe-core report for specific violations
2. Check keyboard navigation paths
3. Verify ARIA labels and roles

#### Performance Issues
1. Check Lighthouse report for specific bottlenecks
2. Analyze network tab for slow requests
3. Review bundle analyzer for large chunks

#### CI/CD Pipeline Failures
1. Check GitHub Actions logs for specific errors
2. Verify environment variables are set
3. Ensure test database is available

### Getting Help
- Check test artifacts in GitHub Actions
- Review Playwright trace files for debugging
- Use `--ui` mode for interactive debugging
- Monitor performance in Chrome DevTools

## Deployment Pipeline

### Staging Deployment
1. Automatic deployment on `main` branch pushes
2. Smoke tests run post-deployment
3. Feedback widget enabled for beta testing
4. Performance monitoring active

### Production Deployment
1. Manual approval required
2. Blue-green deployment strategy
3. Rollback capability
4. Real-time monitoring alerts

This testing infrastructure ensures the Skippy platform maintains high quality, accessibility, and performance standards while providing comprehensive feedback mechanisms for continuous improvement.