import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    channel: "msedge",
  },
  webServer: {
    command: `node scripts/static-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
