import { defineConfig, devices } from "@playwright/test";

/**
 * Партия через бэкенд: сборка с сетевым проводом, поднятая сервером фреймворка.
 *
 * Отдельный конфиг, потому что отличается поставка целиком: у основной сервер отдаёт статические
 * файлы и обработчиков маршрутов не исполняет, у этой их исполняет фреймворк. Переменная задаётся и
 * серверу: конфигурация сборки читается им заново, а статический экспорт `next start` не отдаёт.
 *
 * Сессия на бэкенде одна, поэтому прогоны идут по очереди: параллельные играли бы одну партию.
 */
export default defineConfig({
  testDir: "e2e/backend",
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"] },
    },
  ],
  webServer: {
    command: "npx next start -p 4174",
    env: { NEXT_PUBLIC_ARCANE_BACKEND: "http" },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
  },
});
