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

/** Чистая база на каждый тест: сохранённая сессия переживает перезагрузку по замыслу. */
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

/** Смена режима: она ничего не спрашивает — бой начинают и заканчивают кнопками в самом бою. */
async function switchMode(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("radio", { name }).click();
}

test("combat-screen renders all resource blocks", async ({ page }) => {
  const resources = page.getByLabel("Ресурсы");

  await expect(page.getByRole("heading", { name: "Торн" })).toBeVisible();
  await expect(resources.getByText("Волшебник, 7 уровень", { exact: false })).toBeVisible();
  await expect(resources.getByText("16", { exact: true })).toBeVisible();
  await expect(resources.getByText("+8", { exact: true })).toBeVisible();
  // КД без активных эффектов: 10 базы + 2 Ловкости + 2 предметов.
  await expect(resources.getByText("14", { exact: true })).toBeVisible();

  const slots = page.getByLabel("Ячейки заклинаний");
  await expect(slots.getByRole("listitem")).toHaveCount(4);
  await expect(slots.getByText("4/4")).toBeVisible();

  // Шапка не тратит ряды на отсутствующее: концентрации нет — карточки нет. Экономия хода
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

  // Прокручивается только список заклинаний; страница целиком — нет.
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Заклинания")).toBeVisible();
});

test("combat keeps the first card whole, the book keeps the first row", async ({ page }) => {
  // Бой начат: причина добавляет строке ещё одну строку текста, а бюджет здесь меряет
  // обычную игру — после «Начать бой», а не до него.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();

  // Список, в котором не видно целиком ни одной строки, не список, а щель: до любого заклинания
  // нужно доскроллить, а в бою скроллят одной рукой под чужой ход.
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

  // «Вне боя» списка не показывает вовсе — мерить там нечего.
  // В «Книге» бюджет другой: счётчик подготовки, фильтры и начало первой строки, а не строка
  // целиком: там читают и готовятся, и прокрутка нормальна.
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
  // Экран, который заканчивается шапкой, читается как пустой: начало строки обязано быть видно.
  expect(rowTop, "начало первой строки «Книги»").toBeLessThan(viewport - 24);
});

test("book mode shows only the book", async ({ page }) => {
  // Книга отвечает, что персонаж знает, а не чем он за это заплатит: шапки ресурсов в ней нет.
  await switchMode(page, /^Книга/);

  await expect(page.getByRole("region", { name: "Ресурсы" })).toHaveCount(0);
  await expect(page.getByLabel("Ячейки заклинаний")).toHaveCount(0);
  await expect(page.getByLabel("Прочие ресурсы")).toHaveCount(0);

  // Остаётся то, ради чего книгу открывают: состав, подготовка со счётчиком и фильтры. «Магия
  // крови» в составе: очки заклинаний покупают вне боя, и книга — единственный вход к магии там.
  await expect(page.getByLabel(/^Подготовлено \d+ из \d+/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Магия крови/ })).toBeVisible();
});

test("filter by casting time", async ({ page }) => {
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel("Заклинания");
  // Три подготовленные реакции: «Щит», «Поглощение стихий», «Контрзаклинание».
  await expect(list.getByRole("listitem")).toHaveCount(3);
  // Точное совпадение: подстрока «щит» есть и в подписи роли «Защита».
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Сбросить" }).click();
  // Пятнадцать: четыре заговора и одиннадцать подготовленных минус «Починка», которая творится
  // минуту, плюс строка «Магия крови» в том же списке.
  await expect(list.getByRole("listitem")).toHaveCount(15);
});

test("technical instruction is two taps away", async ({ page }) => {
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByText("Как объявить").click();

  await expect(page.getByText(/Атака заклинанием, модификатор \+8/)).toBeVisible();
});

test("wizard steps order and cast spends the slot", async ({ page }) => {
  // Бой начат: иначе добавила бы шаг «Бой не начат» перед тем, что здесь считается.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();

  // Два основных шага при бюджете в четыре: чем сотворить и объявление с подтверждением.
  await expect(page.getByText("Шаг 1 из 2: Чем сотворить")).toBeVisible();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByLabel("Что сделать")).toContainText("Спишется ячейка 2 уровня");
  await expect(page.getByLabel("Объявление мастеру")).toContainText("ячейкой 2 уровня");
  // Именно раздел, а не список внутри него: «Варианты отыгрыша» содержит ту же подстроку.
  await expect(page.getByRole("region", { name: "Отыгрыш" })).toContainText("Обязательно");

  await page.getByRole("button", { name: "Подтвердить" }).click();

  const slots = page.getByLabel("Ячейки заклинаний");
  await expect(slots.getByText("2/3")).toBeVisible();
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByLabel("Активные эффекты")).toContainText("Доспехи мага");
});

test("undo returns the slot through the journal screen", async ({ page }) => {
  const slots = page.getByLabel("Ячейки заклинаний");

  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(slots.getByText("3/4")).toBeVisible();

  // Отмена живёт только в журнале: в бою кнопки нет вовсе.
  await expect(page.getByRole("button", { name: /^Отменить/ })).toBeHidden();
  await switchMode(page, /^Журнал/);
  await page.getByRole("button", { name: /^Отменить/ }).click();
  // Ячейку возвращают из журнала, а видят в бою: шапки ресурсов в журнале нет.
  await expect(page.getByRole("button", { name: "Отменить: Бой начался" })).toBeVisible();

  // Возврат в бой застаёт тот же бой: журнал его не заканчивает.
  await switchMode(page, /^Бой/);
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Окончить бой" })).toBeVisible();
});

test("state survives a reload", async ({ page }) => {
  // Бой начат: иначе добавила бы шаг «Бой не начат» перед подтверждением.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  // Заодно проверяется, что режим переживает перезапуск.
  await switchMode(page, /^Книга/);

  await page.reload();
  // После перезапуска экран снова «Книга»: ни заголовка с именем, ни шапки ресурсов там нет,
  // поэтому признак загрузки — сам список.
  await expect(page.getByRole("list", { name: /^Заклинания/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Книга/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("reaction shows when it returns", async ({ page }) => {
  // Учёт хода в бою ведётся всегда — включать нечего. Бой нарочно не начат здесь: тест
  // проверяет, что «Начать бой» возвращает реакцию как первый ход, а начатый заранее бой этого
  // не показал бы. Причину проходим «Применить всё равно».
  await page.getByRole("button", { name: /Щит/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Применить всё равно" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByText(/Реакция израсходована, вернётся в начале вашего хода/)).toBeVisible();

  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await expect(page.getByLabel("Реакция доступна")).toBeVisible();
});

test("concentration block explains the effect", async ({ page }) => {
  // «Обнаружение магии» не подготовлено, поэтому в боевом списке его нет вовсе: идём в
  // книгу. Концентрацию оно требует в любом режиме, а творить надо тем способом, что и в бою, —
  // ячейкой, а не ритуалом.
  await switchMode(page, /^Книга/);
  await page.getByRole("button", { name: "Ритуал", exact: true }).click();
  await page.getByRole("button", { name: /^Обнаружение магии/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 1 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  // Шагов три: условия (ритуал неподготовлен), чем сотворить, подтверждение. Отдельного экрана про
  // концентрацию нет — заменять нечего, и о ней говорит инструкция на итоговом.
  await expect(page.getByText("Шаг 3 из 3: Объявление и подтверждение")).toBeVisible();
  await expect(page.getByText(/Держите концентрацию/)).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  // В «Книге» блока действующего нет: она отвечает, что персонаж знает, а не что сейчас держится.
  await expect(page.getByRole("button", { name: /Концентрация: / })).toBeHidden();

  // Блок стоит там, где идёт игра, и виден без открытия карточки заклинания.
  await switchMode(page, /^Бой/);
  const card = page.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Сфера 30 футов от себя");
  await expect(card).toContainText("спасбросок Телосложения");

  // Ключевая механика по-прежнему без прокрутки страницы.
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  await card.click();
  const panel = page.getByRole("dialog", { name: /Концентрация/ });
  await expect(panel.getByLabel("Чем прерывается")).toContainText("Недееспособность или смерть");

  // КС считается по введённому урону.
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

  // Бой начат: иначе причина держала бы каждую строку списка притушенной, а мастер
  // применения открывался бы на шаге «Бой не начат» вместо обычного первого шага.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await scan("экран боя");

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await expect(page.getByRole("dialog", { name: /Доспехи мага/ })).toBeVisible();
  await scan("карточка заклинания");

  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
  await scan("мастер применения");

  // Привал — второй по времени экран после боя: там отдыхают и готовятся.
  await page.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await switchMode(page, /^Вне боя/);
  await scan("привал");

  await switchMode(page, /^Бой/);
  // Точное совпадение: строка «Электрошока» говорит, что цель «не может совершать реакции», и по
  // подстроке кнопка шапки перестала быть единственной.
  await page.getByRole("button", { name: "Реакции", exact: true }).click();
  await page.getByRole("radio", { name: "По мне попали" }).click();
  await scan("экран реакций");
  await page.getByRole("button", { name: "Закрыть" }).click();

  // Журнал — седьмой экран сверки: в нём стоит единственная кнопка отмены, и её
  // доступное имя строится из текста записи, а не задано вручную.
  await switchMode(page, /^Журнал/);
  await expect(page.getByRole("list", { name: "Журнал событий" })).toBeVisible();
  await scan("экран журнала");

  await switchMode(page, /^Вне боя/);

  await page.getByRole("button", { name: /Магическое восстановление/ }).click();
  await expect(page.getByRole("dialog", { name: "Магическое восстановление" })).toBeVisible();
  await scan("магическое восстановление");
});

test("reactions in one tap", async ({ page }) => {
  // Триггер приходит в чужой ход: путь от события до результата обязан быть коротким.
  // Имя точное по той же причине, что и в прогоне axe: «реакции» есть и в тексте «Электрошока».
  await page.getByRole("button", { name: "Реакции", exact: true }).click();
  await page.getByRole("radio", { name: "По мне попали" }).click();

  const matching = page.getByLabel("Подходящие реакции");
  await expect(matching.getByText("Щит", { exact: true })).toBeVisible();
  // Готовое число, а не формула.
  await expect(matching.getByText("КД 19 вместо 14")).toBeVisible();

  await matching.getByRole("button", { name: /Щит/ }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
});

test("book mode prepares spells", async ({ page }) => {
  await switchMode(page, /^Книга/);
  // Стартовый набор занимает лимит целиком, и двенадцатое заклинание в него не влезает.
  await expect(page.getByLabel("Подготовлено 11 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Снять подготовку: Отражения" }).click();
  await expect(page.getByLabel("Подготовлено 10 из 11")).toBeVisible();

  await page.getByRole("button", { name: "Подготовить: Обнаружение магии" }).click();
  await expect(page.getByLabel("Подготовлено 11 из 11")).toBeVisible();

  // Подготовка определяет состав боевого списка.
  await switchMode(page, /^Бой/);
  await expect(page.getByLabel(/^Заклинания/)).toContainText("Обнаружение магии");
});

test("serves the app from cache when the network is gone", async ({ page, context }) => {
  // Игра идёт за столом, где телефон может быть в авиарежиме: офлайн — условие
  // работоспособности, а не оптимизация.
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
  // Бой начат: иначе добавила бы шаг «Бой не начат» перед тратой ячейки.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  // Тратим ячейку в бою, чтобы на привале было что восстанавливать.
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Ячейки заклинаний")).toContainText("3/4");

  await switchMode(page, /^Вне боя/);

  // Вне боя ходов нет: ни отметок схватки, ни счётчика раундов.
  await expect(
    page.getByRole("button", { name: /Начать бой|Окончить бой|Новый ход/ }),
  ).toBeHidden();
  // Точное имя: подстрока «Ресурсы» есть и у списка «Прочие ресурсы».
  await expect(page.getByLabel("Ресурсы", { exact: true })).not.toContainText("раунд");

  // Долгий отдых уничтожает состояние боя, поэтому спрашивает.
  await page.getByRole("button", { name: /Долгий отдых/ }).click();
  await page.getByRole("button", { name: "Отдохнуть" }).click();
  await expect(page.getByLabel("Ячейки заклинаний")).toContainText("4/4");
});

test("blood exchange goes through the wizard, not one tap", async ({ page }) => {
  // Бой начат: иначе обмен предупреждал бы ещё и о том, что бой не начат — тот же текст,
  // что у заклинания, но не то, что здесь проверяется.
  await page.getByRole("button", { name: "Начать бой", exact: true }).click();
  await page.getByRole("button", { name: /Магия крови/ }).click();

  // Строка списка ничего не списала: до подтверждения состояние персонажа не меняется.
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Очки 0");
  await expect(page.getByLabel("Сколько очков создать")).toContainText("6 хитов");

  // Счётчик создаёт запас на два заклинания первого уровня одним действием.
  await page.getByRole("button", { name: "Больше очков" }).click();
  await page.getByRole("button", { name: "Больше очков" }).click();
  await expect(page.getByLabel("Сколько очков создать")).toContainText("12 хитов");

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Действием обмениваю 12 хитов на 4 очка заклинаний.")).toBeVisible();

  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Очки 4");
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Максимум снижен на 12");
});
