import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9876",
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs --host 127.0.0.1 --port 9876 --ttl 10",
    url: "http://127.0.0.1:9876/__health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
