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
  // Признак загрузки — ряд оплаты: заголовка с именем в шапке нет, а ячейки есть в «Игре» всегда.
  await expect(page.getByLabel("Чем платить")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openFreshApp(page);
});

/**
 * Первая строка списка — та, что стоит первой на экране.
 *
 * Уже творённое стоит именами выше упорядоченного ценой списка, поэтому бюджет меряется по ряду
 * имён, когда он есть: карточка под ним первой не является.
 */
const FIRST_ROW = '[aria-label="Часто"] li, [aria-label^="Заклинания"] li';

/** Смена режима: она ничего не спрашивает — бой начинают и заканчивают кнопками в самом бою. */
async function switchMode(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).click();
}

/** Режим из-под «Ещё»: своей ячейки в панели у него нет, и открывает его список. */
async function switchUnderMore(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name: /^Ещё/ }).click();
  await page.getByRole("dialog", { name: "Ещё" }).getByRole("button", { name }).click();
}

async function switchToSheet(page: Page): Promise<void> {
  await switchUnderMore(page, /^Лист/);
}

test("play-screen renders all resource blocks", async ({ page }) => {
  const resources = page.getByLabel("Ресурсы");

  // Имени, класса и уровня в шапке нет: их место — «Лист».
  await expect(page.getByRole("heading", { name: "Торн" })).toBeHidden();
  // КД без активных эффектов: 10 базы + 2 Ловкости + 2 предметов. Чисел заклинателя в шапке нет —
  // их называет строка действия.
  await expect(page.getByRole("button", { name: /^КД 14/ })).toBeVisible();
  await expect(resources.getByText("Атака", { exact: true })).toBeHidden();

  // Ряд оплаты — один: четыре уровня ячеек и три пула отвечают на один вопрос. Нажимаемых мест в
  // нём два: ячейки всех уровней ведут в одну правку, руны — в неё же, а кости и очки правки не
  // имеют вовсе.
  const paying = page.getByLabel("Чем платить");
  await expect(paying.getByRole("button")).toHaveCount(2);
  await expect(paying.getByText("4/4").first()).toBeVisible();
  await expect(paying).toContainText("1 ур.");
  await expect(paying).toContainText("4 ур.");
  await expect(paying).toContainText("Руны");
  await expect(paying).toContainText("Кости d6");
  await expect(paying).toContainText("Очки");

  // Шапка не тратит ряды на отсутствующее: концентрации нет — карточки нет. Экономия хода
  // приходит с боем, а бонусное действие появилось вместе с «Туманным шагом».
  await expect(page.getByRole("button", { name: "Действует: ничего" })).toBeVisible();
  await expect(page.getByLabel("Реакция доступна")).toBeHidden();

  await page.getByRole("button", { name: /^Начать бой/ }).click();
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

  // Ряд оплаты умещается целиком: он не переносится и не прокручивается, поэтому плитка, начатая
  // за краем, за столом не существует, а страница о её выезде молчит — обрезает её предок.
  const paying = await page.getByLabel("Чем платить").evaluate((node) => ({
    over: node.scrollWidth - node.clientWidth,
    beyondEdge: [...node.querySelectorAll("li")].filter(
      (tile) => tile.getBoundingClientRect().right > window.innerWidth,
    ).length,
  }));
  expect(paying.over, "ряд оплаты не шире своего места").toBeLessThanOrEqual(0);
  expect(paying.beyondEdge, "ни одна плитка не ушла за край").toBe(0);
});

test("combat keeps the first card whole, the book keeps the first row", async ({ page }) => {
  // Бой начат: причина добавляет строке ещё одну строку текста, а бюджет здесь меряет
  // обычную игру — после «Начать бой», а не до него.
  await page.getByRole("button", { name: /^Начать бой/ }).click();

  const viewport = page.viewportSize()?.height ?? 0;
  expect(viewport).toBeGreaterThan(0);

  // Список, в котором не видно целиком ни одной строки, не список, а щель. Мерить его нужно после
  // прокрутки: закреплены только хиты и ячейки, остальное уезжает — и вопрос в том, хватает ли
  // высоты под закреплённой полосой на строку целиком.
  const pinned = await page.evaluate((firstRow) => {
    const card = document.querySelector(firstRow);
    const hitPoints = document.querySelector('[aria-label^="Хиты"]');
    const slots = document.querySelector('[aria-label="Чем платить"]');
    if (card === null || hitPoints === null || slots === null) throw new Error("нет узлов");
    // Прокручиваемый предок: первый, чьё содержимое выше собственной высоты.
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
  // Хиты и ячейки прокрутка не уносит: на них смотрят в каждый ход.
  expect(pinned.hitPointsTop, "хиты остались на месте").toBeGreaterThanOrEqual(0);

  // Полоса фильтров тоже вся на экране: переключатель за краем — переключатель, которого нет.
  const strip = await page.getByLabel("Фильтры").evaluate((node) => ({
    scrollWidth: node.firstElementChild?.scrollWidth ?? 0,
    clientWidth: node.firstElementChild?.clientWidth ?? 0,
  }));
  expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);

  // Шесть ячеек панели помещаются в 320 целиком: подпись, ушедшая в многоточие, — подпись, которой
  // нет, а прокрутки у панели не предусмотрено вовсе.
  const panel = await page.getByRole("navigation", { name: "Режим экрана" }).evaluate((node) => ({
    over: node.scrollWidth - node.clientWidth,
    clipped: [...node.querySelectorAll("span")].filter(
      (label) => label.scrollWidth > label.clientWidth + 1,
    ).length,
  }));
  expect(panel.over, "панель не уехала за край").toBeLessThanOrEqual(0);
  expect(panel.clipped, "ни одна подпись не обрезана").toBe(0);

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

  // «Лист» просматривают сверху вниз, поэтому прокрутка внутри области нормальна — но первый блок
  // обязан быть виден целиком, иначе экран открывается на середине первой же строки.
  await switchToSheet(page);

  const sheetLayout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(sheetLayout.documentHeight).toBeLessThanOrEqual(sheetLayout.viewportHeight);
  expect(sheetLayout.horizontalOverflow).toBeLessThanOrEqual(0);

  // Лист открывается персонажем, и первый его блок — «Кто он».
  const firstBlockBottom = await page
    .getByRole("heading", { name: "Кто он" })
    .evaluate((node) => Math.round(node.closest("section")?.getBoundingClientRect().bottom ?? 0));
  expect(firstBlockBottom, "первый блок «Листа» целиком").toBeLessThanOrEqual(viewport);

  // «Привал»: шапка ресурсов и кнопки отдыха видны без прокрутки — больше в режиме ничего и нет.
  await switchMode(page, /^Привал/);

  const restBottom = await page
    .getByRole("button", { name: /Долгий отдых/ })
    .evaluate((node) => Math.round(node.getBoundingClientRect().bottom));
  expect(restBottom, "кнопки отдыха «Привала» целиком").toBeLessThanOrEqual(viewport);
});

/** Заговор творится в один шаг: платить нечем, и мастер спрашивает только подтверждение. */
async function castCantrip(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: "Подтвердить" })).toBeHidden();
  await page.getByRole("button", { name: /^Новый ход/ }).click();
}

/**
 * Самая тяжёлая обстановка боя: схватка идёт, концентрация держится, ход начат, и творили уже не
 * раз.
 *
 * Сотворений несколько, а не одно: наверху списка стоит собранное из случившегося, и на чистом
 * журнале этого веса нет вовсе — бюджет, снятый до первого сотворения, меряет тот экран, которого
 * в бою не бывает.
 */
async function holdConcentrationAfterSeveralCasts(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await castCantrip(page, /^Луч холода/);
  await castCantrip(page, /^Электрошок/);
  await castCantrip(page, /^Сообщение/);
  await page.getByRole("button", { name: /^Паутина/ }).first().click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).first().click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: "Подтвердить" })).toBeHidden();
  await page.getByRole("button", { name: /^Новый ход/ }).click();
}

/**
 * Нижний край видимого: область прокрутки обрезает содержимое своим краем, а панель режимов
 * закрывает остаток экрана. Мерить бюджет высотой окна значит считать видимым то, что лежит под
 * панелью.
 */
async function visibleBottomOfList(page: Page): Promise<number> {
  return page.evaluate(() => {
    const list = document.querySelector('[aria-label^="Заклинания"]');
    if (list === null) throw new Error("список пуст");
    let area = list.parentElement;
    while (area !== null && area.scrollHeight <= area.clientHeight) area = area.parentElement;
    if (area === null) throw new Error("нет области прокрутки");
    return Math.round(area.getBoundingClientRect().bottom);
  });
}

test("the frequent row and the list both start on screen at 320", async ({ page }) => {
  await holdConcentrationAfterSeveralCasts(page);

  const visibleBottom = await visibleBottomOfList(page);
  const measured = await page.evaluate(() => {
    const frequent = document.querySelector('[aria-label="Часто"]');
    const ordered = document.querySelector('[aria-label^="Заклинания"]');
    if (frequent === null || ordered === null) throw new Error("нет раздела или списка");
    let area = ordered.parentElement;
    while (area !== null && area.scrollHeight <= area.clientHeight) area = area.parentElement;
    if (area !== null) area.scrollTop = 0;
    return {
      frequentBottom: Math.round(frequent.getBoundingClientRect().bottom),
      orderedTop: Math.round(ordered.getBoundingClientRect().top),
    };
  });

  expect(measured.frequentBottom, "уже творённое целиком на экране").toBeLessThanOrEqual(
    visibleBottom,
  );
  expect(measured.orderedTop, "упорядоченный список начинается на экране").toBeLessThan(
    visibleBottom,
  );
});

test("the first spell row is whole on screen at 320, 375 and 390", async ({ page }) => {
  await holdConcentrationAfterSeveralCasts(page);

  // Три ширины, а не одна: ряды над списком переносятся по мере сужения, и ряд, стоящий одной
  // строкой на 390, занимает три на 320 — столько же, сколько сама строка списка.
  for (const size of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);

    const shown = await page.evaluate((firstRow) => {
      const first = document.querySelector(firstRow);
      if (first === null) throw new Error("список пуст");
      // Меряется непрокрученный экран: строка, до которой надо доскроллить, за столом не найдена.
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
  // Книга отвечает, что персонаж знает, а не чем он за это заплатит: шапки ресурсов в ней нет.
  await switchMode(page, /^Книга/);

  await expect(page.getByRole("region", { name: "Ресурсы" })).toHaveCount(0);
  await expect(page.getByLabel("Чем платить")).toHaveCount(0);
  await expect(page.getByLabel("Прочие ресурсы")).toHaveCount(0);

  // Остаётся то, ради чего книгу открывают: состав, подготовка со счётчиком и фильтры. «Магия
  // крови» в составе: она подчиняется тем же фильтрам, что и заклинания.
  await expect(page.getByLabel(/^Подготовлено \d+ из \d+/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Магия крови/ })).toBeVisible();
});

test("filter by casting time", async ({ page }) => {
  // Время накладывания спрашивают в «Книге»: в «Игре» его место в полосе занимает роль.
  await switchMode(page, /^Книга/);
  await page.getByRole("button", { name: "Реакция", exact: true }).click();

  const list = page.getByLabel("Заклинания");
  // Четыре реакции книги: «Щит», «Поглощение стихий», «Падение пёрышком», «Контрзаклинание».
  await expect(list.getByRole("listitem")).toHaveCount(4);
  // Точное совпадение: подстрока «щит» есть и в подписи роли «Защита».
  await expect(list.getByText("Щит", { exact: true })).toBeVisible();

  // Снимаем тот же переключатель: кнопки сброса нет — выбранное снимают там, где поставили.
  await page.getByRole("button", { name: "Реакция", exact: true }).click();
  // Тридцать: вся книга Торна с заговорами и строка «Магия крови» в ней же.
  await expect(list.getByRole("listitem")).toHaveCount(30);
});

test("technical instruction is two taps away", async ({ page }) => {
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByText("Как объявить").click();

  await expect(page.getByText(/Атака заклинанием, модификатор \+8/)).toBeVisible();
});

test("wizard steps order and cast spends the slot", async ({ page }) => {
  // Бой начат: в бою и меряется путь применения — ход считается, ячейка тратится.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();

  // Два основных шага при бюджете в четыре: чем сотворить и объявление с подтверждением.
  await expect(page.getByText("Шаг 1 из 2: Чем сотворить")).toBeVisible();
  await page.getByRole("button", { name: /Ячейка 2 уровня/ }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByLabel("Что сделать")).toContainText("Произнести вслух");
  await expect(page.getByLabel("Что сделать")).toContainText("Спишется ячейка 2 уровня");
  await expect(page.getByLabel("Объявление мастеру")).toContainText("ячейкой 2 уровня");
  // Раздел целиком, вместе с вложенным списком вариантов: механической строки нет нигде в нём.
  await expect(page.getByRole("region", { name: "Отыгрыш" })).not.toContainText(
    /произнести вслух/i,
  );

  await page.getByRole("button", { name: "Подтвердить" }).click();

  const slots = page.getByLabel("Чем платить");
  await expect(slots.getByText("2/3")).toBeVisible();
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Действует: Доспехи мага/ })).toBeVisible();
});

test("undo returns the slot through the journal screen", async ({ page }) => {
  const slots = page.getByLabel("Чем платить");

  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(slots.getByText("3/4")).toBeVisible();

  // Отмена живёт только в журнале: в бою кнопки нет вовсе.
  await expect(page.getByRole("button", { name: /^Вернуть/ })).toBeHidden();
  await switchMode(page, /^Журнал/);
  await page.getByRole("button", { name: /^Вернуть/ }).click();
  // Ячейку возвращают из журнала, а видят в бою: шапки ресурсов в журнале нет.
  await expect(page.getByRole("button", { name: "Вернуть: Бой начался" })).toBeVisible();

  // Возврат в бой застаёт тот же бой: журнал его не заканчивает.
  await switchMode(page, /^Игра/);
  await expect(slots.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Окончить бой" })).toBeVisible();
});

test("state survives a reload", async ({ page }) => {
  // Бой начат: путь применения меряется в бою.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Луч холода/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  // Заодно проверяется, что режим переживает перезапуск.
  await switchMode(page, /^Книга/);

  await page.reload();
  // После перезапуска экран снова «Книга»: ни заголовка с именем, ни шапки ресурсов там нет,
  // поэтому признак загрузки — сам список.
  await expect(page.getByRole("list", { name: /^Заклинания/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Книга/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the sheet mode survives a reload and feeds the header", async ({ page }) => {
  await switchToSheet(page);
  // Лист — база персонажа одной колонкой, без вкладок.
  await expect(page.getByRole("heading", { name: "Кто он" })).toBeVisible();

  await page.getByRole("button", { name: "Править: Уровень" }).click();
  const levelSheet = page.getByRole("dialog", { name: "Правка: Уровень" });
  await levelSheet.getByRole("spinbutton", { name: "Уровень" }).fill("8");
  await levelSheet.getByRole("spinbutton", { name: "Базовый максимум хитов" }).fill("66");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("Волшебник, 8")).toBeVisible();

  await page.reload();
  // Режим переживает перезапуск вместе с состоянием: приложение открывается там, где закрыто.
  await expect(page.getByRole("heading", { name: "Кто он" })).toBeVisible();
  await expect(page.getByText("Волшебник, 8")).toBeVisible();

  // Новый уровень дошёл до ячеек: смена уровня — не только строка листа.
  await switchMode(page, /^Игра/);
  await expect(page.getByLabel("Чем платить")).toContainText("4/4");
});

test("reaction shows when it returns", async ({ page }) => {
  // Вне боя ход не считается и реакция не тратится, поэтому прогон идёт в бою: «Щит» её
  // расходует, а «Новый ход» возвращает.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await expect(page.getByLabel("Реакция доступна")).toBeVisible();

  await page.getByRole("button", { name: /Щит/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Реакция израсходована")).toBeVisible();

  await page.getByRole("button", { name: /^Новый ход/ }).click();
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
  await expect(page.getByRole("button", { name: /^Действует: / })).toBeHidden();

  // Строка стоит там, где идёт игра, и называет удерживаемое без открытия карточки заклинания.
  await switchMode(page, /^Игра/);
  const card = page.getByRole("button", { name: /^Действует: Обнаружение магии/ });
  await expect(card).toBeVisible();

  // Ключевая механика по-прежнему без прокрутки страницы.
  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  // Раскрытие отвечает целиком: как работает и чем прервётся.
  await card.click();
  const panel = page.getByRole("dialog", { name: "Действует" });
  await expect(panel).toContainText("Сфера 30 футов от себя");
  await expect(panel.getByLabel("Чем прерывается")).toContainText("Недееспособность или смерть");

  // КС считается по введённому урону.
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

  // Бой начат: сверяется тот экран, за которым сидят в бою.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await scan("экран боя");

  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await expect(page.getByRole("dialog", { name: /Доспехи мага/ })).toBeVisible();
  await scan("карточка заклинания");

  await page.getByRole("button", { name: "Сотворить" }).click();
  await expect(page.getByRole("dialog", { name: /Применение/ })).toBeVisible();
  await scan("мастер применения");

  // Привал — отдельный режим, а не шторка поверх экрана: отдых и восстановление не помещаются на
  // экран вместе со списком заклинаний.
  await page.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Окончить бой" }).click();
  await page.getByRole("button", { name: "Да, бой закончен" }).click();
  await switchMode(page, /^Привал/);
  await expect(page.getByRole("button", { name: /Короткий отдых/ })).toBeVisible();
  await scan("привал");

  // «Реакции» стоит только в «Игре»: привал её не показывает — там читают отдых, а не ждут триггер.
  await switchMode(page, /^Игра/);

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

  // Лист — восьмой экран сверки: блоки персонажа, шторка правки и переключатели внутри неё.
  await switchToSheet(page);
  await expect(page.getByRole("heading", { name: "Кто он" })).toBeVisible();
  await scan("лист персонажа");

  // Вещи — экран сверки из трёх частей. Экипировка: защита, надетое со своим глаголом и запас
  // со своим вводом.
  await switchMode(page, /^Вещи/);
  await expect(page.getByRole("heading", { name: "Защита" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Снять один: Плащ защиты" })).toBeVisible();
  await scan("экипировка");

  // Сумка: кошелёк, разделы категорий, строки ввода и шторка одной вещи.
  await page.getByRole("radio", { name: "Сумка" }).click();
  await expect(page.getByRole("heading", { name: "Деньги" })).toBeVisible();
  await scan("сумка");

  await page.getByRole("textbox", { name: "Новый расходник" }).fill("Зелье лечения");
  await page.getByRole("textbox", { name: "Новый расходник" }).press("Enter");
  await page.getByRole("button", { name: "Открыть: Зелье лечения" }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Зелье лечения" })).toBeVisible();
  await scan("шторка вещи");
  await page.getByRole("button", { name: "Отмена" }).click();

  await page.getByRole("button", { name: "Править: Деньги" }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Деньги" })).toBeVisible();
  await scan("шторка денег");
  await page.getByRole("button", { name: "Отмена" }).click();

  // Покупки: то, чего в сумке нет, со своей строкой и своим прибавлением.
  await page.getByRole("radio", { name: "Покупки" }).click();
  await expect(page.getByRole("list", { name: "Купить" })).toBeVisible();
  await scan("покупки");

  await switchToSheet(page);

  await page.getByRole("button", { name: "Править: Интеллект" }).click();
  await expect(page.getByRole("dialog", { name: "Правка: Интеллект" })).toBeVisible();
  await scan("шторка правки листа");
  await page.getByRole("button", { name: "Отмена" }).click();

  await switchMode(page, /^Привал/);

  // Короткий отдых — предусловие правила: до него восстановление недоступно.
  await page.getByRole("button", { name: /Короткий отдых/ }).click();
  await page.getByRole("button", { name: /Магическое восстановление/ }).click();
  await expect(page.getByRole("dialog", { name: "Магическое восстановление" })).toBeVisible();
  await scan("магическое восстановление");
});

/**
 * Прогон выше идёт в светлой теме — той, что браузер отдаёт по умолчанию. Тёмная сверяется целиком и
 * по всем режимам: играют вечером, и подпись на подкрашенной подложке ведёт себя там иначе — цвет
 * значения и подложка того же значения не могут быть одной светлоты.
 */
test("every mode passes axe-core in the dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });

  const scan = async (label: string): Promise<void> => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, `${label}: ${JSON.stringify(results.violations, null, 2)}`).toEqual(
      [],
    );
  };

  await scan("игра");

  for (const mode of ["Книга", "Журнал", "Вещи", "Привал"]) {
    await switchMode(page, new RegExp(`^${mode}`));
    await scan(mode.toLowerCase());
  }

  await switchToSheet(page);
  await scan("лист");

  await switchUnderMore(page, /^Ремесло/);
  await scan("ремесло");

  await switchUnderMore(page, /^Заметки/);
  await scan("заметки");
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
  await switchMode(page, /^Игра/);
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
  // Бой начат: тратим ячейку в бою, чтобы после него было что восстанавливать.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  // Тратим ячейку в бою, чтобы на привале было что восстанавливать.
  await page.getByRole("button", { name: /Доспехи мага/ }).click();
  await page.getByRole("button", { name: "Сотворить" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Чем платить")).toContainText("3/4");

  // Бой заканчивают кнопкой, а не вкладкой: вкладка на состояние игры не влияет.
  await page.getByRole("button", { name: "Окончить бой" }).click();
  await page.getByRole("button", { name: "Да, бой закончен" }).click();

  // Вне боя ходов нет: ни «Нового хода», ни счётчика раундов.
  await expect(page.getByRole("button", { name: /Окончить бой|Новый ход/ })).toBeHidden();
  // Точное имя: подстрока «Ресурсы» есть и у списка «Прочие ресурсы».
  await expect(page.getByLabel("Ресурсы", { exact: true })).not.toContainText("Раунд");

  // Долгий отдых уничтожает состояние боя, поэтому спрашивает.
  await switchMode(page, /^Привал/);
  await page.getByRole("button", { name: /Долгий отдых/ }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Чем платить")).toContainText("4/4");
});

test("combat keeps camp mode reachable, but rest refuses with a reason", async ({ page }) => {
  // Мода не является правилом: переключатель режима работает в бою так же, как вне его — а
  // отдых внутри самого режима обязан отказать, а не притвориться, что кнопки не было.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await switchMode(page, /^Привал/);

  const shortRest = page.getByRole("button", { name: /Короткий отдых.*Пока идёт бой, короткий отдых недоступен/ });
  await expect(shortRest).toBeDisabled();
  const longRest = page.getByRole("button", { name: /Долгий отдых.*Пока идёт бой, долгий отдых недоступен/ });
  await expect(longRest).toBeDisabled();

  // Ячейки не тронуты: клик по выключенной кнопке в браузере не срабатывает вовсе.
  await expect(page.getByLabel("Чем платить")).toContainText("4/4");
});

test("blood exchange goes through the wizard, not one tap", async ({ page }) => {
  // Бой начат: обмен тратит действие, и проверяется он там, где действие считается.
  await page.getByRole("button", { name: /^Начать бой/ }).click();
  await page.getByRole("button", { name: /Магия крови/ }).click();

  // Строка списка ничего не списала: до подтверждения состояние персонажа не меняется. Пустой пул
  // называет себя знаком отказа при остатке, а не при подписи.
  await expect(page.getByLabel("Чем платить")).toContainText("Очки✗ 0");
  await expect(page.getByLabel("Сколько очков создать")).toContainText("6 хитов");

  // Счётчик создаёт запас на два заклинания первого уровня одним действием.
  await page.getByRole("button", { name: "Больше очков" }).click();
  await page.getByRole("button", { name: "Больше очков" }).click();
  await expect(page.getByLabel("Сколько очков создать")).toContainText("12 хитов");

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Действием обмениваю 12 хитов на 4 очка заклинаний.")).toBeVisible();

  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByLabel("Чем платить")).toContainText("Очки4");
  await expect(page.getByLabel("Прочие ресурсы")).toContainText("Максимум снижен на 12");
});

test("search reaches a row without scrolling", async ({ page }) => {
  const list = page.getByLabel("Заклинания");
  const lightning = page.getByRole("button", { name: /Молния/ });

  // До «Молнии» полтора экрана прокрутки: без поиска её на экране нет вовсе.
  await expect(lightning).not.toBeInViewport();

  await page.getByRole("button", { name: "Поиск по названию" }).click();
  await page.getByRole("searchbox", { name: "Поиск по названию" }).fill("молн");

  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(lightning).toBeInViewport();

  // Выбранная строка закрывает поиск и отпускает список: слово не прячет книгу молча.
  await lightning.click();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("searchbox", { name: "Поиск по названию" })).toBeHidden();
  await expect(list.getByRole("listitem")).toHaveCount(20);
});
