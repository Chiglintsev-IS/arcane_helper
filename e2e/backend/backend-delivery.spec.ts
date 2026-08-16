import { expect, test, type Page } from "@playwright/test";

/**
 * Партия через бэкенд: то же приложение, другой провод.
 *
 * Здесь проверяется не игра — её проверяют прогоны основной поставки, — а шов. Доказательств два, и
 * оба видны только в браузере: партия идёт, а состояния у браузера нет вовсе; перезагрузка ничего
 * не теряет, потому что игра живёт не здесь.
 *
 * Сессия на бэкенде одна, и она переживает прогон: партия начинается с чистого стола той же
 * командой, какой начинают заново с экрана.
 */

/** Чистый стол на каждый прогон: сессия бэкенда общая, и следы прошлой партии — не свои. */
async function startFreshParty(page: Page): Promise<void> {
  const started = page.waitForResponse((response) => response.url().includes("/api/arcane/session"));
  await page.request.post("/api/arcane/command", {
    data: { commandId: crypto.randomUUID(), command: { kind: "reset" } },
  });
  await page.goto("/");
  await started;
  await expect(page.getByLabel("Чем платить")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await startFreshParty(page);
});

test("a party goes through the backend and the browser keeps no state", async ({ page }) => {
  const spent = page.getByRole("button", { name: "Ячейки 2 уровня: 2 из 3" });
  await expect(page.getByRole("button", { name: "Ячейки 2 уровня: 3 из 3" })).toBeVisible();

  // Ход играется тот же, что и без сети: команда уезжает на бэкенд, снимок приезжает обратно.
  const applied = page.waitForResponse((response) => response.url().includes("/api/arcane/command"));
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await applied;

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  // Объявление приезжает ответом на вопрос: набранного в состоянии ещё нет.
  await expect(page.getByLabel("Объявление мастеру")).toContainText("ячейкой 2 уровня");
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(spent).toBeVisible();

  // Партия живёт на бэкенде: перезагрузка приносит её обратно, хотя браузеру хранить нечего.
  await page.reload();
  await expect(spent).toBeVisible();
  await expect(page.getByRole("button", { name: /^Действует: Доспехи мага/ })).toBeVisible();

  // Ни одной базы: ядро в этой сборке в браузер не приезжает, и хранить состояние тут нечему.
  expect(await page.evaluate(() => indexedDB.databases().then((bases) => bases.length))).toBe(0);
});
