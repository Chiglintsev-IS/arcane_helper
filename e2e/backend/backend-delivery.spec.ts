import { expect, test, type Page } from "@playwright/test";

async function startFreshParty(page: Page): Promise<void> {
  const started = page.waitForResponse((response) => response.url().includes("/api/arcane/session"));
  await page.request.post("/api/arcane/command", {
    data: { commandId: crypto.randomUUID(), command: { kind: "reset" } },
  });
  await page.goto("/");
  await started;
  await expect(page.getByRole("region", { name: "Ресурсы" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await startFreshParty(page);
});

test("a party goes through the backend and the browser keeps no state", async ({ page }) => {
  const spent = page.getByRole("button", { name: "Ячейки 2 уровня: 2 из 3" });
  await expect(page.getByRole("button", { name: "Ячейки 2 уровня: 3 из 3" })).toBeVisible();

  const applied = page.waitForResponse((response) => response.url().includes("/api/arcane/command"));
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await applied;

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(spent).toBeVisible();

  await page.reload();
  await expect(spent).toBeVisible();
  await expect(page.getByRole("button", { name: /^Действует: Доспехи мага/ })).toBeVisible();

  expect(await page.evaluate(() => indexedDB.databases().then((bases) => bases.length))).toBe(0);
});
