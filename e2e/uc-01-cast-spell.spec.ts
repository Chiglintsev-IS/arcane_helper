import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByRole("region", { name: "Ресурсы" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openFreshApp(page);
});

const FIRST_ROW = '[aria-label^="Заклинания"] li';

async function switchMode(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name: /Режимы$/ }).click();
  await page.getByRole("dialog", { name: "Режимы" }).getByRole("button", { name }).click();
}

async function switchToSheet(page: Page): Promise<void> {
  await switchMode(page, /^Лист/);
}

test("play-screen renders all resource blocks", async ({ page }) => {
  const resources = page.getByLabel("Ресурсы");

  await expect(page.getByRole("heading", { name: "Торн" })).toBeHidden();
  await expect(page.getByRole("button", { name: /^КД 14/ })).toBeVisible();
  await expect(resources.getByText("Атака", { exact: true })).toBeHidden();

  const resourceHeader = page.getByRole("region", { name: "Ресурсы" });
  await expect(resourceHeader.getByRole("button")).toHaveCount(4);
  await expect(resourceHeader).toContainText("Руны");
  await expect(resourceHeader).toContainText("Кости d6");
  await expect(resourceHeader).toContainText("30 футов");
  await expect(resourceHeader).toContainText("Средний");

  const slots = page.getByRole("button", { name: /Ячейки 1 уровня/ });
  await expect(slots.getByText("4/4").first()).toBeVisible();
  await expect(slots).toContainText("1 ур.");
  await expect(slots).toContainText("4 ур.");

  await expect(page.getByRole("button", { name: "Действует: ничего" })).toBeVisible();
  await expect(page.getByLabel("Прочие ресурсы")).toBeEmpty();

  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await expect(page.getByLabel("Прочие ресурсы")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Учёт хода", exact: true })).toBeHidden();
});

test("key mechanics fit iPhone SE without scrolling", async ({ page }) => {
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Заклинания")).toBeVisible();

  const paying = await page
    .getByRole("region", { name: "Ресурсы" })
    .evaluate((node) => ({
      over: node.scrollWidth - node.clientWidth,
      beyondEdge: [...node.querySelectorAll("dd, span, dt")].filter(
        (tile) => tile.getBoundingClientRect().right > window.innerWidth,
      ).length,
    }));
  expect(paying.over, "шапка не шире своего места").toBeLessThanOrEqual(0);
  expect(paying.beyondEdge, "ни одна плитка не ушла за край").toBe(0);
});

test("combat keeps the first card whole, the book keeps the first row", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();

  const viewport = page.viewportSize()?.height ?? 0;
  expect(viewport).toBeGreaterThan(0);

  const pinned = await page.evaluate((firstRow) => {
    const card = document.querySelector(firstRow);
    const hitPoints = document.querySelector('[aria-label^="Хиты"]');
    const slots = document.querySelector('[aria-label="Ресурсы"]');
    if (card === null || hitPoints === null || slots === null) throw new Error("нет узлов");
    let area = card.parentElement;
    while (area !== null && area.scrollHeight <= area.clientHeight) area = area.parentElement;
    if (area === null) throw new Error("нет области прокрутки");
    const pinnedBottom = (): number => Math.round(slots.getBoundingClientRect().bottom);
    area.scrollTop += Math.round(card.getBoundingClientRect().top) - pinnedBottom();
    return {
      cardTop: Math.round(card.getBoundingClientRect().top),
      cardBottom: Math.round(card.getBoundingClientRect().bottom),
      pinnedBottom: pinnedBottom(),
      hitPointsTop: Math.round(hitPoints.getBoundingClientRect().top),
    };
  }, FIRST_ROW);

  expect(pinned.cardTop, "строка встала под закреплённой полосой").toBeGreaterThanOrEqual(
    pinned.pinnedBottom - 1,
  );
  expect(pinned.cardBottom, "бой: строка целиком под закреплённой полосой").toBeLessThanOrEqual(
    viewport,
  );
  expect(pinned.hitPointsTop, "хиты остались на месте").toBeGreaterThanOrEqual(0);

  const strip = await page.getByLabel("Фильтры").evaluate((node) => ({
    scrollWidth: node.firstElementChild?.scrollWidth ?? 0,
    clientWidth: node.firstElementChild?.clientWidth ?? 0,
  }));
  expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);

  const panel = await page.getByRole("navigation", { name: "Режим экрана" }).evaluate((node) => ({
    over: node.scrollWidth - node.clientWidth,
    clipped: [...node.querySelectorAll("span")].filter(
      (label) => label.scrollWidth > label.clientWidth + 1,
    ).length,
  }));
  expect(panel.over, "панель не уехала за край").toBeLessThanOrEqual(0);
  expect(panel.clipped, "ни одна подпись не обрезана").toBe(0);

  await switchMode(page, /^Книга/);

  const filtersBottom = await page
    .getByLabel("Фильтры")
    .evaluate((node) => Math.round(node.getBoundingClientRect().bottom));
  expect(filtersBottom, "полоса фильтров «Книги» целиком").toBeLessThanOrEqual(viewport);

  const rowTop = await page.evaluate(() => {
    const first = document.querySelector('[aria-label^="Заклинания"] li');
    if (first === null) throw new Error("список пуст");
    return Math.round(first.getBoundingClientRect().top);
  });
  expect(rowTop, "начало первой строки «Книги»").toBeLessThan(viewport - 24);

  await switchToSheet(page);

  const sheetLayout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(sheetLayout.documentHeight).toBeLessThanOrEqual(sheetLayout.viewportHeight);
  expect(sheetLayout.horizontalOverflow).toBeLessThanOrEqual(0);

  const firstGroupBottom = await page
    .getByRole("button", { name: /^Сила / })
    .evaluate((node) => Math.round(node.closest("section")?.getBoundingClientRect().bottom ?? 0));
  expect(firstGroupBottom, "первая группа «Бросков» целиком").toBeLessThanOrEqual(viewport);

  await switchMode(page, /^Привал/);

  const restBottom = await page
    .getByRole("button", { name: /Долгий отдых/ })
    .evaluate((node) => Math.round(node.getBoundingClientRect().bottom));
  expect(restBottom, "кнопки отдыха «Привала» целиком").toBeLessThanOrEqual(viewport);
});

async function castCantrip(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("button", { name: "Сотворить" })).toBeHidden();
  await page.getByRole("button", { name: /^Новый ход/ }).click();
}

async function holdConcentrationAfterSeveralCasts(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await castCantrip(page, /^Луч холода/);
  await castCantrip(page, /^Электрошок/);
  await castCantrip(page, /^Сообщение/);
  await page.getByRole("button", { name: /^Паутина/ }).first().click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).first().click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: "Подтвердить" })).toBeHidden();
  await page.getByRole("button", { name: /^Новый ход/ }).click();
}

test("the first spell row is whole on screen at 320, 375 and 390", async ({ page }) => {
  await holdConcentrationAfterSeveralCasts(page);

  for (const size of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);

    const shown = await page.evaluate((firstRow) => {
      const first = document.querySelector(firstRow);
      if (first === null) throw new Error("список пуст");
      let area = first.parentElement;
      while (area !== null && area.scrollHeight <= area.clientHeight) area = area.parentElement;
      if (area === null) throw new Error("нет области прокрутки");
      area.scrollTop = 0;
      return {
        bottom: Math.round(first.getBoundingClientRect().bottom),
        visibleBottom: Math.round(area.getBoundingClientRect().bottom),
        pageOverflow: document.documentElement.scrollHeight - window.innerHeight,
        sideways: document.documentElement.scrollWidth - window.innerWidth,
      };
    }, FIRST_ROW);

    expect(shown.bottom, `первая строка целиком на ${size.width}`).toBeLessThanOrEqual(
      shown.visibleBottom,
    );
    expect(shown.pageOverflow, `страница не прокручивается на ${size.width}`).toBeLessThanOrEqual(0);
    expect(shown.sideways, `нет бокового выезда на ${size.width}`).toBeLessThanOrEqual(0);
  }
});

test("book mode shows only the book", async ({ page }) => {
  await switchMode(page, /^Книга/);

  await expect(page.getByRole("region", { name: "Ресурсы" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toHaveCount(0);
  await expect(page.getByLabel("Прочие ресурсы")).toHaveCount(0);

  await expect(page.getByLabel(/^Подготовлено \d+ из \d+/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Последняя подсказка/ })).toBeVisible();
});

test("filter by casting time", async ({ page }) => {
  await switchMode(page, /^Книга/);
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel("Заклинания");
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Реакция", exact: true }).click();
  await expect(list.getByRole("listitem")).toHaveCount(30);
});

test("technical instruction is two taps away", async ({ page }) => {
  await page.getByRole("button", { name: /Луч холода/ }).click();

  const card = page.getByRole("dialog", { name: /Луч холода/ });
  const roll = card.getByLabel("Механика").locator("dt", { hasText: "Мой бросок" });
  await expect(roll).toBeVisible();
  await expect(roll.locator("xpath=following-sibling::dd[1]")).toHaveText("Атака d20+8");
});

test("wizard steps order and cast spends the slot", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();

  await expect(page.getByText("Шаг 1 из 1: Чем сотворить")).toBeVisible();
  await expect(page.getByRole("button", { name: "Далее" })).toBeHidden();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();

  await page.getByRole("button", { name: "Подтвердить" }).click();

  const slots = page.getByRole("button", { name: /Ячейки 1 уровня/ });
  await expect(slots.getByText("2/3")).toBeVisible();
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Действует: Доспехи мага/ })).toBeVisible();
});

test("undo returns the slot through the log screen", async ({ page }) => {
  const slots = page.getByRole("button", { name: /Ячейки 1 уровня/ });

  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(slots.getByText("3/4")).toBeVisible();

  await expect(page.getByRole("button", { name: /^Вернуть/ })).toBeHidden();
  await switchMode(page, /^Лог/);
  await page.getByRole("button", { name: /^Вернуть/ }).click();
  await expect(page.getByRole("button", { name: "Вернуть: Бой начался" })).toBeVisible();

  await switchMode(page, /^Игра/);
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Окончить бой" })).toBeVisible();
});

test("state survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await switchMode(page, /^Книга/);

  await page.reload();
  await expect(page.getByRole("list", { name: /^Заклинания/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Режимы$/ })).toContainText("Книга");
});

test("the sheet mode survives a reload and feeds the header", async ({ page }) => {
  await switchToSheet(page);
  await expect(page.getByRole("tab", { name: "Броски" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Кто он" }).click();
  await expect(page.getByRole("heading", { name: "Кто он" })).toBeVisible();

  await page.getByRole("button", { name: "Правка: Уровень" }).click();
  const levelSheet = page.getByRole("dialog", { name: "Правка: Уровень" });
  await levelSheet.getByRole("spinbutton", { name: "Уровень" }).fill("8");
  await levelSheet.getByRole("spinbutton", { name: "Базовый максимум хитов" }).fill("66");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("Волшебник, 8")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Броски" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Кто он" }).click();
  await expect(page.getByText("Волшебник, 8")).toBeVisible();

  await switchMode(page, /^Игра/);
  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toContainText("4/4");
});

test("reaction shows when it returns", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await expect(page.getByLabel("Реакция израсходована")).toBeHidden();

  await page.getByRole("button", { name: /Щит/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Реакция израсходована")).toBeVisible();

  await page.getByRole("button", { name: /^Новый ход/ }).click();
  await expect(page.getByLabel("Реакция израсходована")).toBeHidden();
});

test("concentration block explains the effect", async ({ page }) => {
  await switchMode(page, /^Книга/);
  await page.getByRole("button", { name: "Ритуал", exact: true }).click();
  await page.getByRole("button", { name: /^Обнаружение магии/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 1 уровня/ }).click();

  await expect(page.getByText("Шаг 2 из 2: Чем сотворить")).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByRole("button", { name: /^Действует: / })).toBeHidden();

  await switchMode(page, /^Игра/);
  const card = page.getByRole("button", { name: /^Действует: Обнаружение магии/ });
  await expect(card).toBeVisible();

  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await card.click();
  const panel = page.getByRole("dialog", { name: "Действует" });
  await expect(panel).toContainText("Сфера 30 футов от себя");
  await expect(panel.getByLabel("Чем прерывается")).toContainText("Недееспособность или смерть");

  await panel.getByRole("button", { name: "Получил урон" }).click();
  await page.getByLabel("Полученный урон").fill("24");
  await page.getByRole("button", { name: "Подтвердить" }).click();
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

  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await scan("экран боя");

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await expect(page.getByRole("dialog", { name: /Доспехи мага/ })).toBeVisible();
  await scan("карточка заклинания");

  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
  await scan("мастер применения");

  await page.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Окончить бой" }).click();
  await page.getByRole("button", { name: "Да, бой закончен" }).click();
  await switchMode(page, /^Привал/);
  await expect(page.getByRole("button", { name: /Короткий отдых/ })).toBeVisible();
  await scan("привал");

  await switchMode(page, /^Игра/);

  await page.getByRole("button", { name: "Реакция", exact: true }).click();
  await page.getByRole("button", { name: /Знаки ограждения/ }).click();
  await scan("шторка руны");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  await switchMode(page, /^Лог/);
  await expect(page.getByRole("list", { name: "Лог событий" })).toBeVisible();
  await scan("экран лога");

  await switchToSheet(page);
  await expect(page.getByRole("tab", { name: "Броски" })).toBeVisible();
  await scan("лист персонажа, броски");
  await page.getByRole("tab", { name: "Кто он" }).click();
  await expect(page.getByRole("heading", { name: "Кто он" })).toBeVisible();
  await scan("лист персонажа, кто он");

  await switchMode(page, /^Вещи/);
  await expect(page.getByRole("heading", { name: "Деньги" })).toBeVisible();
  await scan("сумка");

  await page.getByRole("radio", { name: "Экипировка" }).click();
  await expect(page.getByRole("heading", { name: "Защита" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Снять один: Плащ защиты" })).toBeVisible();
  await scan("экипировка");

  await page.getByRole("radio", { name: "Расходники" }).click();
  await page.getByRole("textbox", { name: "Новый расходник" }).fill("Зелье лечения");
  await page.getByRole("textbox", { name: "Новый расходник" }).press("Enter");
  await page.getByRole("button", { name: "Правка: Зелье лечения" }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Зелье лечения" })).toBeVisible();
  await scan("шторка вещи");
  await page.getByRole("button", { name: "Добавить прибавку" }).click();
  await expect(page.getByRole("dialog", { name: "К чему прибавка" })).toBeVisible();
  await scan("выбор величины прибавки");
  await page
    .getByRole("dialog", { name: "К чему прибавка" })
    .getByRole("button", { name: "Отмена" })
    .click();
  await page.getByRole("button", { name: "Отмена" }).click();

  await page.getByRole("button", { name: "Правка: Деньги" }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Деньги" })).toBeVisible();
  await scan("шторка денег");
  await page.getByRole("button", { name: "Отмена" }).click();

  await page.getByRole("radio", { name: "Все вещи" }).click();
  await expect(page.getByLabel("Поиск")).toBeVisible();
  await page.getByRole("radio", { name: "Покупки" }).click();
  await page.getByRole("textbox", { name: "Что купить" }).fill("Верёвка");
  await page.getByRole("textbox", { name: "Что купить" }).press("Enter");
  await expect(page.getByRole("button", { name: "Правка: Верёвка" })).toBeVisible();
  await scan("покупки");

  await switchToSheet(page);

  await page.getByRole("button", { name: /^Интеллект 18/ }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Интеллект" })).toBeVisible();
  await scan("шторка правки листа");
  await page.getByRole("button", { name: "Отмена" }).click();

  await switchMode(page, /^Привал/);

  await page.getByRole("button", { name: /Короткий отдых/ }).click();
  await page.getByRole("button", { name: /Магическое восстановление/ }).click();
  await expect(page.getByRole("dialog", { name: "Магическое восстановление" })).toBeVisible();
  await scan("магическое восстановление");
});

test("every mode passes axe-core in both themes", async ({ page }) => {
  const scan = async (label: string): Promise<void> => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, `${label}: ${JSON.stringify(results.violations, null, 2)}`).toEqual(
      [],
    );
  };

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });

    await switchMode(page, /^Игра/);
    await scan(`${scheme}: игра`);

    for (const mode of [
      "Книга",
      "Лог",
      "Вещи",
      "Привал",
      "Лист",
      "Алхимия",
      "Кузнечное дело",
      "Фамильяр",
      "Заметки",
    ]) {
      await switchMode(page, new RegExp(`^${mode}`));
      await scan(`${scheme}: ${mode.toLowerCase()}`);
    }
  }
});

test("reactions in one tap", async ({ page }) => {
  // Имя точное по той же причине, что и в прогоне axe: «реакция» есть и в тексте «Электрошока».
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel(/^Заклинания/);
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();
  await expect(list.getByText("КД 19 вместо 14")).toBeVisible();
  await expect(list.getByText("Знаки ограждения", { exact: true })).toBeVisible();

  await list.getByRole("button", { name: /Щит/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
});

test("book mode prepares spells", async ({ page }) => {
  await switchMode(page, /^Книга/);
  await expect(page.getByLabel("Подготовлено 11 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Снять подготовку: Крепость интеллекта" }).click();
  await expect(page.getByLabel("Подготовлено 10 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Подготовить: Обнаружение магии" }).click();
  await expect(page.getByLabel("Подготовлено 11 из 11")).toBeVisible();

  await switchMode(page, /^Игра/);
  await expect(page.getByLabel(/^Заклинания/)).toContainText("Обнаружение магии");
});

test("serves the app from cache when the network is gone", async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  });

  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0] ?? "");
      const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
      return paths.includes("/index.html") && paths.some((path) => path.startsWith("/_next/"));
    },
    null,
    { timeout: 10_000 },
  );

  // Сеть глушится маршрутом, а не `setOffline`: перехват идёт после service worker, то есть
  await context.route("**", (route) => route.abort());
  const offline = await page.evaluate(async () => {
    const response = await fetch("./index.html");
    return { ok: response.ok, html: (await response.text()).includes("Arcane Helper") };
  });
  await context.unroute("**");

  expect(offline).toEqual({ ok: true, html: true });
});

test("camp mode reaches rest and recovery", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toContainText("3/4");

  await page.getByRole("button", { name: "Окончить бой" }).click();
  await page.getByRole("button", { name: "Да, бой закончен" }).click();

  await expect(page.getByRole("button", { name: /Окончить бой|Новый ход/ })).toBeHidden();
  await expect(page.getByLabel("Ресурсы", { exact: true })).not.toContainText("Раунд");

  await switchMode(page, /^Привал/);
  await page.getByRole("button", { name: /Долгий отдых/ }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toContainText("4/4");
});

test("combat keeps camp mode reachable, but rest refuses with a reason", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await switchMode(page, /^Привал/);

  const shortRest = page.getByRole("button", { name: /Короткий отдых.*Пока идёт бой, короткий отдых недоступен/ });
  await expect(shortRest).toBeDisabled();
  const longRest = page.getByRole("button", { name: /Долгий отдых.*Пока идёт бой, долгий отдых недоступен/ });
  await expect(longRest).toBeDisabled();

  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toContainText("4/4");
});

test("blood pays for a slot inside the cast wizard", async ({ page }) => {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();

  await page.getByRole("button", { name: /^Кровью · ячейка 1 уровня/ }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByRole("button", { name: /Ячейки 1 уровня/ })).toContainText("1 ур.4/4");
  await expect(page.getByRole("region", { name: "Ресурсы" })).toContainText("54/54");
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Максимум снижен на 6");
});

test("search reaches a row without scrolling", async ({ page }) => {
  const list = page.getByLabel("Заклинания");
  const lightning = page.getByRole("button", { name: /Молния/ });

  await expect(lightning).not.toBeInViewport();

  await page.getByRole("button", { name: "Поиск по названию" }).click();
  await page.getByRole("searchbox", { name: "Поиск по названию" }).fill("молн");

  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(lightning).toBeInViewport();

  await lightning.click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("searchbox", { name: "Поиск по названию" })).toBeHidden();
  await expect(list.getByRole("listitem")).toHaveCount(20);
});
