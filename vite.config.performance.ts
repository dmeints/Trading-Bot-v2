import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          react: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          charts: ['recharts', 'framer-motion'],
          
          // Feature chunks
          trading: [
            './client/src/components/trading/TradingChart.tsx',
            './client/src/components/trading/QuickTradePanel.tsx',
            './client/src/components/trading/PortfolioSummary.tsx'
          ],
          ai: [
            './client/src/components/ai/CopilotChat.tsx',
            './client/src/components/ai/MarketInsights.tsx',
            './client/src/components/ai/AIRecommendations.tsx'
          ],
          analytics: [
            './client/src/pages/Analytics.tsx',
            './client/src/components/analytics/BacktestResults.tsx',
            './client/src/components/analytics/PerformanceMetrics.tsx'
          ]
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 600,
    // Enable source maps for production debugging
    sourcemap: true,
  },
  // Development server optimization
  server: {
    hmr: {
      overlay: false, // Reduce development overhead
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', 'zustand'],
    exclude: ['@radix-ui/react-icons'], // Only load when needed
  },
});