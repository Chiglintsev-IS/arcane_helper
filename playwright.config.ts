import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-прогоны в мобильных viewport (docs/quality.md#e2e-тесты).
 *
 * iPhone SE обязателен: на нём проверяется требование «ключевая механика без прокрутки»
 * ([F-01](docs/features/F-01-combat-screen.md)). Остальные размеры добавляются по мере надобности —
 * тратить время прогона на три одинаковых сценария смысла нет, пока вёрстка одна.
 *
 * Сервер поднимает сборку статического экспорта: именно её получит телефон, а не dev-режим.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"] },
    },
  ],
  webServer: {
    command: "npx http-server out -p 4173 -a 127.0.0.1 --silent",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
  },
});
