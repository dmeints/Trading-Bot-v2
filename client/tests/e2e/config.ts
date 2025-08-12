import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: __dirname,
  reporter: [["list"]],
  use: { 
    baseURL: "http://localhost:5000", 
    trace: "on-first-retry" 
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 12"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    port: 5000,
    reuseExistingServer: !process.env.CI,
  },
});