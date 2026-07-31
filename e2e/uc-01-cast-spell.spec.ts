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

  // Шапка не тратит ряды на отсутствующее: концентрации нет — карточки нет (FR-001). Экономия хода
  // в бою ведётся всегда, а бонусное действие появилось вместе с «Туманным шагом».
  await expect(page.getByLabel("Концентрация")).toBeHidden();
  await expect(page.getByLabel("Реакция доступна")).toBeVisible();
  await expect(page.getByLabel("Бонусное действие доступно")).toBeVisible();
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

test("first card fits without scrolling in every mode", async ({ page }) => {
  // Список, в котором не видно целиком ни одной строки, не список, а щель: до любого заклинания
  // нужно доскроллить, а в бою скроллят одной рукой под чужой ход (F-18, ux.md#общие-правила).
  const firstCardBottom = async (): Promise<number> =>
    page.evaluate(() => {
      const first = document.querySelector('[aria-label^="Заклинания"] li');
      if (first === null) throw new Error("список пуст");
      return Math.round(first.getBoundingClientRect().bottom);
    });

  const viewport = page.viewportSize()?.height ?? 0;
  expect(viewport).toBeGreaterThan(0);

  expect(await firstCardBottom(), "бой").toBeLessThanOrEqual(viewport);

  // Полоса фильтров тоже вся на экране: переключатель за краем — переключатель, которого нет.
  const strip = await page.getByLabel("Фильтры").evaluate((node) => ({
    scrollWidth: node.firstElementChild?.scrollWidth ?? 0,
    clientWidth: node.firstElementChild?.clientWidth ?? 0,
  }));
  expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);

  for (const mode of ["Привал", "Книга"]) {
    await page.getByRole("radio", { name: new RegExp(`^${mode}`) }).click();
    expect(await firstCardBottom(), mode).toBeLessThanOrEqual(viewport);
  }
});

test("filter by casting time", async ({ page }) => {
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel("Заклинания");
  // Три подготовленные реакции: «Щит», «Поглощение стихий», «Контрзаклинание».
  await expect(list.getByRole("listitem")).toHaveCount(3);
  // Точное совпадение: подстрока «щит» есть и в подписи роли «Защита» (FR-211).
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Сбросить" }).click();
  // Пятнадцать: четыре заговора и одиннадцать подготовленных минус «Починка», которая творится
  // минуту (FR-201), плюс строка «Магия крови» в том же списке (FR-207).
  await expect(list.getByRole("listitem")).toHaveCount(15);
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
  await page.getByRole("button", { name: /^Обнаружение магии/ }).click();
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

  await page.getByRole("radio", { name: /^Бой/ }).click();
  await page.getByRole("button", { name: "Реакции" }).click();
  await page.getByRole("radio", { name: "По мне попали" }).click();
  await scan("экран реакций");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("radio", { name: /^Привал/ }).click();

  await page.getByRole("button", { name: /Магическое восстановление/ }).click();
  await expect(page.getByRole("dialog", { name: "Магическое восстановление" })).toBeVisible();
  await scan("магическое восстановление");
});

test("reactions in one tap", async ({ page }) => {
  // Триггер приходит в чужой ход: путь от события до результата обязан быть коротким (AC-08).
  await page.getByRole("button", { name: "Реакции" }).click();
  await page.getByRole("radio", { name: "По мне попали" }).click();

  const matching = page.getByLabel("Подходящие реакции");
  await expect(matching.getByText("Щит", { exact: true })).toBeVisible();
  // Готовое число, а не формула (FR-062).
  await expect(matching.getByText("КД 19 вместо 14")).toBeVisible();

  await matching.getByRole("button", { name: /Щит/ }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
});

test("book mode prepares spells", async ({ page }) => {
  await page.getByRole("radio", { name: /^Книга/ }).click();
  // Стартовый набор занимает лимит целиком, и двенадцатое заклинание в него не влезает (FR-101).
  await expect(page.getByText("Подготовлено 11 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Снять подготовку: Отражения" }).click();
  await expect(page.getByText("Подготовлено 10 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Подготовить: Обнаружение магии" }).click();
  await expect(page.getByText("Подготовлено 11 из 11")).toBeVisible();

  // Подготовка определяет состав боевого списка (FR-209).
  await page.getByRole("radio", { name: /^Бой/ }).click();
  await expect(page.getByLabel(/^Заклинания/)).toContainText("Обнаружение магии");
});

test("serves the app from cache when the network is gone", async ({ page, context }) => {
  // Игра идёт за столом, где телефон может быть в авиарежиме: офлайн — условие
  // работоспособности, а не оптимизация (NFR-001, NFR-002, AC-02).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 10_000,
  });

  // Оболочка и её ресурсы оседают в кэше по мере загрузки: список файлов сборки заранее
  // неизвестен — статический экспорт даёт имена с хешами.
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
  // отвечать будет именно кэш. Перезагрузку под перехватом WebKit не выполняет, поэтому
  // проверяется сам запрос — он и есть то, что делает браузер при открытии в офлайне.
  await context.route("**", (route) => route.abort());
  const offline = await page.evaluate(async () => {
    const response = await fetch("./index.html");
    return { ok: response.ok, html: (await response.text()).includes("Arcane Helper") };
  });
  await context.unroute("**");

  expect(offline).toEqual({ ok: true, html: true });
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

test("blood exchange goes through the wizard, not one tap", async ({ page }) => {
  await page.getByRole("button", { name: /Магия крови/ }).click();

  // Строка списка ничего не списала: до подтверждения состояние персонажа не меняется (FR-177).
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Очки 0");
  await expect(page.getByLabel("Сколько очков создать")).toContainText("6 хитов");

  // Счётчик создаёт запас на два заклинания первого уровня одним действием (FR-178).
  await page.getByRole("button", { name: "Больше очков" }).click();
  await page.getByRole("button", { name: "Больше очков" }).click();
  await expect(page.getByLabel("Сколько очков создать")).toContainText("12 хитов");

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Действием обмениваю 12 хитов на 4 очка заклинаний.")).toBeVisible();

  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Очки 4");
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Максимум снижен на 12");
});
