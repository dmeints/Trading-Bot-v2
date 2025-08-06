module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5000'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Performance thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }], // < 1.5s
        'interactive': ['error', { maxNumericValue: 3000 }],           // < 3s
        'speed-index': ['error', { maxNumericValue: 2500 }],           // < 2.5s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1
        
        // Bundle size checks
        'total-byte-weight': ['warn', { maxNumericValue: 512000 }],    // < 500KB
        'unused-javascript': ['warn', { maxNumericValue: 102400 }],    // < 100KB
        
        // Best practices
        'uses-https': 'error',
        'uses-http2': 'warn',
        'uses-responsive-images': 'warn',
        'efficient-animated-content': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};