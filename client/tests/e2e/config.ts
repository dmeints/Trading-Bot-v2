import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: __dirname,
  reporter: [["list"]],
  use: { 
    baseURL: "http://localhost:5000", 
    trace: "on-first-retry" 
  },
  projects: [
    { 
      name: "mobile", 
      use: { ...devices["iPhone 12"] } 
    },
    { 
      name: "desktop", 
      use: { ...devices["Desktop Chrome"] } 
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5000,
    reuseExistingServer: !process.env.CI,
  },
});