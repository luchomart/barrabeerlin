import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "4173";

// Por defecto usa Microsoft Edge del sistema (Windows).
// En Linux: PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:smoke
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const navegador = CHROMIUM_PATH
  ? { launchOptions: { executablePath: CHROMIUM_PATH } }
  : { channel: "msedge" };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    ...navegador,
  },
  webServer: {
    command: `node scripts/static-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
