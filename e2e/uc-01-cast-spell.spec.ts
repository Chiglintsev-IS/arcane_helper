import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * UC-01 «Выбор и применение заклинания в свой ход» на настоящей сборке статического экспорта.
 *
 * Здесь проверяется то, чего не видно в компонентных тестах: помещается ли ключевая механика на
 * экран iPhone SE, сколько нажатий занимает путь до технической инструкции и не ломает ли вёрстка
 * доступность. Состояние живёт в IndexedDB, поэтому каждый тест начинает с чистой базы — иначе
 * прогоны видят потраченные ячейки друг друга.
 */

/** Чистая база на каждый тест: сохранённая сессия переживает перезагрузку по замыслу (NFR-003). */
async function openFreshApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("arcane-helper");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Торн" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openFreshApp(page);
});

test("combat-screen renders all resource blocks", async ({ page }) => {
  const resources = page.getByLabel("Ресурсы");

  await expect(page.getByRole("heading", { name: "Торн" })).toBeVisible();
  await expect(resources.getByText("Волшебник, 7 уровень", { exact: false })).toBeVisible();
  await expect(resources.getByText("16", { exact: true })).toBeVisible();
  await expect(resources.getByText("+8", { exact: true })).toBeVisible();
  // КД без активных эффектов: 10 базы + 2 Ловкости + 2 предметов (FR-093).
  await expect(resources.getByText("14", { exact: true })).toBeVisible();

  const slots = page.getByLabel("Ячейки заклинаний");
  await expect(slots.getByRole("listitem")).toHaveCount(4);
  await expect(slots.getByText("4/4")).toBeVisible();

  // Шапка не тратит ряды на отсутствующее: концентрации нет — карточки нет; бонусного действия нет
  // ни у одной карточки — ни значка, ни переключателя (FR-001). Экономия хода в бою ведётся всегда.
  await expect(page.getByLabel("Концентрация")).toBeHidden();
  await expect(page.getByLabel("Реакция доступна")).toBeVisible();
  await expect(page.getByRole("button", { name: "Бонусное", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Учёт хода", exact: true })).toBeHidden();
});

test("key mechanics fit iPhone SE without scrolling", async ({ page }) => {
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // Прокручивается только список заклинаний; страница целиком — нет (F-01).
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Заклинания")).toBeVisible();
});

test("first combat card fits without scrolling", async ({ page }) => {
  // Список, в котором не видно целиком ни одной строки, не список, а щель: до любого заклинания
  // нужно доскроллить, а в бою скроллят одной рукой под чужой ход (F-18, ux.md#общие-правила).
  const fit = await page.evaluate(() => {
    const first = document.querySelector('[aria-label^="Заклинания"] li');
    if (first === null) return null;
    const box = first.getBoundingClientRect();
    return { bottom: Math.round(box.bottom), viewport: window.innerHeight };
  });

  expect(fit).not.toBeNull();
  expect(fit!.bottom).toBeLessThanOrEqual(fit!.viewport);

  // Полоса фильтров тоже вся на экране: переключатель за краем — переключатель, которого нет.
  const filters = page.getByLabel("Фильтры");
  const strip = await filters.evaluate((node) => ({
    scrollWidth: node.firstElementChild?.scrollWidth ?? 0,
    clientWidth: node.firstElementChild?.clientWidth ?? 0,
  }));
  expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);
});

test("filter by casting time", async ({ page }) => {
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel("Заклинания");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  // Точное совпадение: подстрока «щит» есть и в подписи роли «Защита» (FR-211).
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Сбросить" }).click();
  // Восемь: семь карточек боя — девять режима минус два неподготовленных ритуала (FR-103, FR-201) —
  // и строка «Магия крови», которая стоит в том же списке и тратит то же действие (FR-207).
  await expect(list.getByRole("listitem")).toHaveCount(8);
});

test("technical instruction is two taps away", async ({ page }) => {
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByText("Как объявить").click();

  await expect(page.getByText(/Атака заклинанием, модификатор \+8/)).toBeVisible();
});

test("wizard steps order and cast spends the slot", async ({ page }) => {
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();

  // Два основных шага при бюджете M-03 в четыре: чем сотворить и объявление с подтверждением.
  await expect(page.getByText("Шаг 1 из 2: Чем сотворить")).toBeVisible();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByLabel("Что сделать")).toContainText("Спишется ячейка 2 уровня");
  await expect(page.getByLabel("Объявление мастеру")).toContainText("ячейкой 2 уровня");
  await expect(page.getByLabel("Отыгрыш")).toContainText("Обязательно");

  await page.getByRole("button", { name: "Подтвердить" }).click();

  const slots = page.getByLabel("Ячейки заклинаний");
  await expect(slots.getByText("2/3")).toBeVisible();
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByLabel("Активные эффекты")).toContainText("Доспехи мага");
});

test("state survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  // Заодно проверяется, что режим переживает перезапуск (FR-204).
  await page.getByRole("radio", { name: /^Книга/ }).click();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Торн" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Книга/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("reaction shows when it returns", async ({ page }) => {
  // Учёт хода в бою ведётся всегда — включать нечего (FR-143).
  await page.getByRole("button", { name: /Щит/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByText(/Реакция израсходована, вернётся в начале вашего хода/)).toBeVisible();

  await page.getByRole("button", { name: "Мой ход начался" }).click();
  await expect(page.getByLabel("Реакция доступна")).toBeVisible();
});

test("concentration block explains the effect", async ({ page }) => {
  // «Обнаружение магии» не подготовлено, поэтому в боевом списке его нет вовсе (FR-209): идём в
  // книгу. Концентрацию оно требует в любом режиме, а творить надо тем способом, что и в бою, —
  // ячейкой, а не ритуалом.
  await page.getByRole("radio", { name: /^Книга/ }).click();
  await page.getByRole("button", { name: "Ритуал", exact: true }).click();
  await page.getByRole("button", { name: /Обнаружение магии/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 1 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  // Ритуал неподготовлен, а заклинание концентрационное, поэтому шагов четыре: условия, чем
  // сотворить, концентрация и подтверждение. Шаг концентрации — то самое предупреждение FR-081.
  await expect(page.getByText("Шаг 3 из 4: Концентрация")).toBeVisible();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  // Виден после закрытия карточки заклинания (AC-14).
  const card = page.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Сфера 30 футов от себя");
  await expect(card).toContainText("спасбросок Телосложения");

  // Ключевая механика по-прежнему без прокрутки страницы (F-01).
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await card.click();
  const panel = page.getByRole("dialog", { name: /Концентрация/ });
  await expect(panel.getByLabel("Чем прерывается")).toContainText("Недееспособность или смерть");

  // КС считается по введённому урону (AC-15).
  await panel.getByRole("button", { name: "Получил урон" }).click();
  await page.getByLabel("Полученный урон").fill("24");
  await page.getByRole("button", { name: "Записать" }).click();
  await expect(page.getByRole("dialog", { name: "Проверка концентрации" })).toContainText("КС 12");
});

test("combat screen, spell card and wizard pass axe-core", async ({ page }) => {
  const scan = async (label: string): Promise<void> => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, `${label}: ${JSON.stringify(results.violations, null, 2)}`).toEqual(
      [],
    );
  };

  await scan("экран боя");

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await expect(page.getByRole("dialog", { name: /Доспехи мага/ })).toBeVisible();
  await scan("карточка заклинания");

  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
  await scan("мастер применения");

  // Привал — второй по времени экран после боя: там отдыхают и готовятся (FR-202).
  await page.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("radio", { name: /^Привал/ }).click();
  await scan("привал");

  await page.getByRole("button", { name: /Магическое восстановление/ }).click();
  await expect(page.getByRole("dialog", { name: "Магическое восстановление" })).toBeVisible();
  await scan("магическое восстановление");
});

test("camp mode reaches rest and recovery", async ({ page }) => {
  // Тратим ячейку в бою, чтобы на привале было что восстанавливать.
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Ячейки заклинаний")).toContainText("3/4");

  await page.getByRole("radio", { name: /^Привал/ }).click();

  // Вне боя ходов нет: ни кнопки, ни счётчика раундов (FR-202).
  await expect(page.getByRole("button", { name: "Мой ход начался" })).toBeHidden();
  // Точное имя: подстрока «Ресурсы» есть и у списка «Прочие ресурсы».
  await expect(page.getByLabel("Ресурсы", { exact: true })).not.toContainText("раунд");

  // Долгий отдых уничтожает состояние боя, поэтому спрашивает (FR-133).
  await page.getByRole("button", { name: /Долгий отдых/ }).click();
  await page.getByRole("button", { name: "Отдохнуть" }).click();
  await expect(page.getByLabel("Ячейки заклинаний")).toContainText("4/4");
});
