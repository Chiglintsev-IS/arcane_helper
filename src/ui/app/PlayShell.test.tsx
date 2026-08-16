// @vitest-environment jsdom

/**
 * Оболочка: панель режимов, полосы над ней и выбор режима, переживающий перезапуск.
 *
 * Хранилище режима — настоящее `localStorage` тестового DOM: подмена его моком проверяла бы мок, а
 * ломается здесь именно чтение чужого значения.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { PlayShell } from "@/ui/app/PlayShell";
import {
  createStoresOverUnreadableSave,
  renderOn,
  renderWithStores,
  shown,
  slotsLeft,
} from "@/ui/app/testing/stores";
import { withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";

/** Бой отмечен начатым: только тогда ведётся учёт хода. */
const IN_FIGHT = { inFight: true } as const;

/** Рендер сразу в «Книге»: путь до неё проверяется отдельно, здесь она нужна как обстановка. */
async function inBookMode(character?: CharacterState) {
  const user = userEvent.setup();
  const result = await renderWithStores(<PlayShell initialMode="book" />, character);
  return { user, ...result };
}

/** Уйти в журнал: ячейка панели названа по режиму и подсказке. */
async function openJournal(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /^Журнал/ }));
}

/** Уйти в лист: своей ячейки у него нет — его открывает список «Ещё». */
async function openSheet(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /^Ещё/ }));
  await user.click(within(screen.getByRole("dialog", { name: "Ещё" })).getByRole("button", { name: /^Лист/ }));
}

/** Торн с 12 хитами: урон получен так же, как в бою. */
function wounded(): CharacterState {
  return withDamage(createThorne(), 48);
}

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
function concentrating(): CharacterState {
  return {
    ...createThorne(),
    concentration: { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" },
    activeEffects: [
      {
        id: "effect-1",
        spellId: "detect-magic",
        nameRu: "Обнаружение магии",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "minutes", value: 10 },
        isConcentration: true,
        slotLevelUsed: 1,
        contributions: [],
        endConditionRu: "До конца концентрации или истечения длительности.",
      },
    ],
  };
}

const STORAGE_KEY = "playScreenMode";

/** Выбран ли режим: панель помечает текущий, и это единственный признак на экране. */
function selected(title: string): boolean {
  return (
    screen.getByRole("button", { name: new RegExp(`^${title}`) }).getAttribute("aria-current") ===
    "page"
  );
}

/**
 * Поля, в которых стоит шапка: ближайший предок, задающий ей горизонтальный отступ.
 *
 * Тестовый DOM разметку не раскладывает — стилей в нём нет, — поэтому одинаковость полей читается
 * по самому отступу, а не по измеренной ширине плитки.
 */
function gutterOfHeader(): string {
  let node = screen.getByLabelText("Ресурсы").parentElement;
  while (node !== null) {
    const gutter = [...node.classList].find((name) => name.startsWith("px-"));
    if (gutter !== undefined) return gutter;
    node = node.parentElement;
  }
  return "";
}

/** Шторка «Действует» открывается со строки действующего в «Игре». */
async function openPanel(): Promise<void> {
  await renderWithStores(<PlayShell />, concentrating());
  await userEvent.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));
}

/** Ввод урона: он же вход в проверку концентрации, когда она идёт. */
async function damage(
  amount: string,
  character: CharacterState = concentrating(),
  situation: { inFight?: boolean } = {},
): Promise<void> {
  await renderWithStores(<PlayShell />, character, situation);
  await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
  await userEvent.type(screen.getByLabelText("Полученный урон"), amount);
  await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
}

describe("режим экрана переживает перезапуск (FR-204)", () => {
  it("открывает сохранённый режим", async () => {
    localStorage.setItem(STORAGE_KEY, "rest");

    await renderWithStores(<PlayShell />);

    expect(selected("Привал")).toBe(true);
  });

  it("переключение запоминается", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Вещи/ }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("things");
  });

  it("битое значение читается как отсутствующее и открывает «Игру»", async () => {
    // Значение приходит из чужих рук: прежняя версия, ручная правка, мусор в хранилище. Раньше
    // оно доходило до разбора режима как есть и не попадало ни в одну ветку — экран не рисовался.
    localStorage.setItem(STORAGE_KEY, "combat");

    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
  });

  it("панель показывает пять режимов, шестой ярлык открывает остальные (FR-204)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const panel = within(screen.getByRole("navigation", { name: "Режим экрана" }));
    expect(panel.getAllByRole("button").map((cell) => cell.textContent)).toEqual([
      "Игра",
      "Книга",
      "Вещи",
      "Привал",
      "Журнал",
      "Ещё",
    ]);
    // Ярлык «Ещё» называет, что под ним лежит: иначе за ним пришлось бы лезть, чтобы узнать.
    expect(panel.getByRole("button", { name: "Ещё: Лист, Ремесло, Заметки" })).toBeDefined();

    // Панель прокрутки не держит: все шесть помещаются, и прокручивать нечего.
    await user.click(screen.getByRole("button", { name: /^Привал/ }));
    expect(selected("Привал")).toBe(true);
  });

  it("«Ещё» отмечен, пока показан режим из-под него (FR-204)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await openSheet(user);

    // Иначе панель отвечала бы, что не показано ничего: у «Листа» своей ячейки нет.
    expect(selected("Ещё")).toBe(true);
    expect(selected("Игра")).toBe(false);
    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
  });

  /**
   * Единственная подмена в этих прогонах, и подменяется в ней не наш код, а платформа: приватный
   * режим Safari бросает на самом обращении к хранилищу, и воспроизвести это иначе нечем.
   */
  it("недоступное хранилище не мешает открыться", async () => {
    const unavailable = (): never => {
      throw new Error("SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(unavailable);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(unavailable);
    const user = userEvent.setup();

    await renderWithStores(<PlayShell />);
    await user.click(screen.getByRole("button", { name: /^Книга/ }));

    expect(selected("Книга")).toBe(true);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("состав экрана (FR-001, AC-14)", () => {
  it("отмена применения возвращает КД к 14", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByRole("button", { name: /^КД 17/ })).toBeDefined();

    // Отменяют только в журнале. Шапки там нет, но блок действующего есть: отмена уносит эффект,
    // и это видно на том же экране, где нажали кнопку.
    await user.click(screen.getByRole("button", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));
    expect(screen.queryByText(/Доспехи мага · КД/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Игра/ }));
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();
  });

});

describe("режимы экрана (FR-200, FR-201, FR-204)", () => {
  it("начинает с «Игры» и показывает всё творимое сейчас (FR-209)", async () => {
    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    // Пока бой не идёт, торопиться некуда: долгое накладывание и ритуал из книги на месте.
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.getByText("Поиск фамильяра")).toBeDefined();
  });

  it("режим попадает в состояние, а журнал не засоряет (FR-204)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Книга/ }));

    // Сохранение — да, запись в журнал — нет: режим меняет вид, отменять в нём нечего.
    expect(shown(stores).journal).toHaveLength(0);
  });

  it("«Ритуал» спрашивает про способ, а не про признак записи (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    // Пока бой не идёт, ритуалом сотворить можно — переключатель на месте и в «Игре», и в «Книге».
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();

    // С началом боя способа нет нигде: ритуал занимает на десять минут больше обычного, и вкладка
    // этого не меняет.
    await user.click(screen.getByRole("button", { name: /^Игра/ }));
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
  });

  it("шапка одинакова в «Игре» и «Привале»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inGame = gutterOfHeader();

    await user.click(screen.getByRole("button", { name: /^Привал/ }));

    // Шапка без полей упирается плиткой в край экрана, и то же число стоит в двух режимах по-разному.
    expect(inGame).not.toBe("");
    expect(gutterOfHeader()).toBe(inGame);
  });

});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("руны правятся вручную и правка обратима (FR-111)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Потратить: Руны" }));
    expect(shown(stores).resources.runes.remaining).toBe(2);

    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    // Кнопка отмены живёт только в журнале — путь к ней длиннее на одно нажатие.
    await user.click(screen.getByRole("button", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));
    expect(shown(stores).resources.runes.remaining).toBe(3);
  });

});

describe("выгрузка и загрузка (FR-120, FR-121, FR-122)", () => {
  it("«Данные» живут в «Журнале» (FR-222)", async () => {
    await renderWithStores(<PlayShell />);
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await inBookMode();
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await renderWithStores(<PlayShell initialMode="journal" />);
    expect(screen.getByRole("button", { name: "Данные" })).toBeDefined();
  });

});

describe("подготовка в «Книге» (FR-214, FR-101)", () => {
  it("подготовленное появляется в боевом списке (FR-209)", async () => {
    const user = userEvent.setup();
    await inBookMode();

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Отражения" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    await user.click(screen.getByRole("button", { name: /^Игра/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Обнаружение магии")).toBeDefined();
    expect(list.queryByText("Отражения")).toBeNull();
  });

  it("отказ по лимиту не двигает список (FR-101)", async () => {
    // Набор Торна занимает предел целиком: двенадцатое упирается в него без подготовки состояния.
    const { user } = await inBookMode();

    const counter = screen.getByLabelText(/^Подготовлено \d+ из \d+/);
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));

    // Ответ пришёл в тот же узел, в котором стоял счёт: над списком не прибавилось ни строки, и
    // строка, по которой метил палец, осталась на месте.
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBe(counter);
    expect(counter.textContent).toContain("Снимите другое заклинание");
    // Полоса оболочки того же отказа не повторяет: она стоит у верхнего края, а кнопка — в списке.
    expect(screen.queryByRole("alert")).toBeNull();
  });

});

describe("конец боя (FR-216, FR-221)", () => {
  it("переход между привалом и книгой вопроса не задаёт: бой уже позади", async () => {
    const user = userEvent.setup();
    const character = wounded();
    await renderWithStores(<PlayShell />, character);

    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });

});

describe("краткая карточка (FR-010)", () => {
  it("угол карточки занимает роль во всех режимах (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inFight = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inFight.getByText("Боевое")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^Книга/ }));

    // Карточка одна на все режимы: разный вид читался как две разные программы.
    const inBook = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inBook.getByText("Боевое")).toBeDefined();
  });

});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("учёт хода следует из отметки боя, а не из вкладки (FR-143)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    // Кнопки «Учёт хода» нет: она умела выключить счёт и оставить зелёные галочки.
    expect(screen.queryByRole("button", { name: "Учёт хода" })).toBeNull();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();

    // Уход в «Книгу» на учёт не влияет: признак приходит из журнала, а не из вкладки.
    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    await user.click(screen.getByRole("button", { name: /^Игра/ }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
  });

});

describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("кнопка «Реакции» есть в «Игре», но не в «Книге» (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    expect(screen.getByRole("button", { name: /^Реакции/ })).toBeDefined();

    // «Книга» — не место для реакции: её открывают заранее, а не в чужой ход.
    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: /^Реакции/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Игра/ }));
    expect(screen.getByRole("button", { name: /^Реакции/ })).toBeDefined();
  });

});

describe("режим «Журнал» (FR-114, FR-220)", () => {
  it("в «Игре» и «Книге» кнопки отмены нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();
  });

  it("переключение в «Журнал» показывает записи", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openJournal(user);

    expect(
      within(screen.getByRole("list", { name: "Журнал событий" })).getByText(/Бой начался/),
    ).toBeDefined();
  });

  it("отмена из журнала возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(slotsLeft(stores, 1)).toBe(3);

    await openJournal(user);
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));

    expect(slotsLeft(stores, 1)).toBe(4);
    // Экран не закрылся: кнопка переехала на запись «Бой начался», и её тоже можно отменить.
    expect(screen.getByRole("button", { name: "Вернуть: Бой начался" })).toBeDefined();
  });

});

describe("одно дело — одно слово (FR-264)", () => {
  it("правка листа сохраняется, случившееся за столом подтверждается", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    // Хиты отвечают на вопрос «что случилось»: урон и лечение происходят, а не заполняются.
    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    const events = within(screen.getByRole("dialog", { name: "Хиты" }));
    expect(events.getByRole("button", { name: "Подтвердить" })).toBeDefined();
    expect(events.queryByRole("button", { name: "Сохранить" })).toBeNull();
    await user.click(events.getByRole("button", { name: "Отмена" }));

    // Характеристика — запись листа: повтор сохранения оставит её той же.
    await openSheet(user);
    await user.click(screen.getByRole("button", { name: "Правка: Интеллект" }));
    const record = within(screen.getByRole("dialog", { name: "Правка: Интеллект" }));
    expect(record.getByRole("button", { name: "Сохранить" })).toBeDefined();
    expect(record.queryByRole("button", { name: "Подтвердить" })).toBeNull();
  });

  it("дверь названа одним словом снаружи и внутри", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    // Плитка обещает вопрос, которым шторка и встречает: правкой зовётся запись, которую
    // сохраняют, а урон и лечение за столом подтверждают.
    await user.click(
      screen.getByRole("button", {
        name: "Хиты 60/60. Что случилось: урон, лечение, временные, максимум",
      }),
    );
    expect(screen.getByRole("dialog", { name: "Хиты" })).toBeDefined();
    expect(screen.getByText("Что случилось?")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    // Поправку кладёт мастер: снаружи названо то же, что набирают внутри.
    await user.click(screen.getByRole("button", { name: "КД 14. Поправка" }));
    expect(screen.getByRole("dialog", { name: "КД" })).toBeDefined();
    expect(screen.getByLabelText("Поправка")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    // Запись правят, и слово правки одно: то, что читают на двери, и то, что произносят за неё.
    await user.click(screen.getByRole("button", { name: /^Вещи/ }));
    await user.click(screen.getByRole("radio", { name: "Сумка" }));
    const money = screen.getByRole("button", { name: "Правка: Деньги" });
    expect(money.textContent).toBe("Правка");
    await user.click(money);
    expect(screen.getByRole("dialog", { name: "Правка: Деньги" })).toBeDefined();
  });

  it("уход со шторки и возврат сделанного зовутся по-разному", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openJournal(user);

    // Пока оба дела звались отменой, соседство «Отменить» и «Отмена» обещало одно и то же.
    expect(screen.getByRole("button", { name: "Вернуть: Бой начался" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Отмен/ })).toBeNull();
  });
});

describe("лист концентрации (FR-084, FR-091)", () => {
  it("снимает концентрацию вручную и пишет это в журнал", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Вернуть: Концентрация завершена: снята вручную/ }),
    ).toBeDefined();
  });

});

describe("проверка концентрации (FR-083, FR-154)", () => {
  it("успех оставляет концентрацию и не пишет запись", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Успех" }));

    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: /^Проверка концентрации/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    // Последняя запись журнала — урон, а не результат проверки.
    expect(screen.getByRole("button", { name: /Вернуть: Получено урона: 24/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    // Бой отмечен начатым — значит учёт хода ведётся и трата реакции видна в шапке.
    const character = concentrating();
    await damage("24", character, { inFight: true });
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByLabelText("Чем платить").textContent).toContain("2/3");
    // Значок траты реакции есть только в бою — он проверяется до ухода в журнал.
    expect(screen.getByRole("button", { name: /^Реакции\. Реакция израсходована/ })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Вернуть: Знаки ограждения/ }),
    ).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", {
        name: /Вернуть: Концентрация завершена: провалена проверка концентрации/,
      }),
    ).toBeDefined();
  });

});

describe("завершение активного эффекта (FR-091)", () => {
  it("закрывает неконцентрационный эффект и пишет это в журнал", async () => {
    const character: CharacterState = {
      ...createThorne(),
      activeEffects: [
        {
          id: "effect-2",
          spellId: "mage-armor",
          nameRu: "Доспехи мага",
          startedAt: "2026-07-31T18:00:00.000Z",
          duration: { type: "hours", value: 8 },
          isConcentration: false,
          slotLevelUsed: 1,
          contributions: [],
          endConditionRu: "До истечения длительности.",
        },
      ],
    };
    await renderWithStores(<PlayShell />, character);

    await userEvent.click(screen.getByRole("button", { name: /^Действует: Доспехи мага/ }));
    await userEvent.click(screen.getByRole("button", { name: "Завершить: Доспехи мага" }));
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    expect(screen.getByRole("button", { name: "Действует: ничего" })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Вернуть: Эффект завершён: Доспехи мага/ }),
    ).toBeDefined();
  });

});

describe("ручной статус (FR-236)", () => {
  it("заводит статус без вклада в КД и его можно снять", async () => {
    await renderWithStores(<PlayShell />);

    await userEvent.click(screen.getByRole("button", { name: "Действует: ничего" }));
    const field = screen.getByLabelText<HTMLInputElement>("Новый статус");
    await userEvent.type(field, "Опутанный{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    const line = screen.getByLabelText("Действует");
    expect(within(line).getByText(/Опутанный/)).toBeDefined();
    expect(within(line).queryByText(/КД/)).toBeNull();
    // Поле готово к следующему статусу без лишнего нажатия.
    expect(field.value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: /^Действует: Опутанный/ }));
    await userEvent.click(screen.getByRole("button", { name: "Завершить: Опутанный" }));
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.getByRole("button", { name: "Действует: ничего" })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Журнал/ }));
    // Отменить можно только последнюю запись — снятие эффекта; начало осталось строкой без кнопки.
    expect(screen.getByText("Эффект начат: Опутанный")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Вернуть: Эффект завершён: Опутанный/ }),
    ).toBeDefined();
  });

});

describe("отдых и бой: отказ приходит с причиной (FR-215)", () => {
  it("«Привал» остаётся доступным в бою, а отдых отказывает с причиной, а не пропадает (FR-215)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    // Мода не спрашивает про бой: панель режимов работает в бою так же, как вне его.
    await user.click(screen.getByRole("button", { name: /^Привал/ }));

    const shortRest = screen.getByRole("button", {
      name: "Короткий отдых · 10 минут Пока идёт бой, короткий отдых недоступен: 10 минут между двумя ходами не проходят",
    });
    expect(shortRest.hasAttribute("disabled")).toBe(true);

    const longRest = screen.getByRole("button", { name: "Долгий отдых Пока идёт бой, долгий отдых недоступен" });
    expect(longRest.hasAttribute("disabled")).toBe(true);

    // Подпись несёт ещё и остаток дневного бюджета, поэтому имя проверяется началом и причиной.
    const recovery = screen.getByRole("button", {
      name: /^Магическое восстановление .* Пока идёт бой, магическое восстановление недоступно$/,
    });
    expect(recovery.hasAttribute("disabled")).toBe(true);
  });

  it("отключённая кнопка отдыха не меняет состояние по клику (FR-215)", async () => {
    // Защита в два слоя: кнопка выключена атрибутом `disabled`, а сценарий отказал бы и без него.
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /^Привал/ }));
    await user.click(
      screen.getByRole("button", { name: "Долгий отдых Пока идёт бой, долгий отдых недоступен" }),
    );

    expect(shown(stores).journal.at(-1)?.kind).not.toBe("long_rest");
    expect(screen.queryByRole("dialog", { name: "Долгий отдых?" })).toBeNull();
  });
});

describe("экран показывает только своё (FR-217, FR-220)", () => {
  it("списка, фильтров и отметок схватки в журнале нет", async () => {
    const user = userEvent.setup();
    // Бой отмечен начатым до перехода: до него переключатель называется «Начать бой», и проверка
    // одного имени «Окончить бой» прошла бы при любой утечке. Ищем все имена сразу.
    await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);
    await openJournal(user);

    expect(screen.queryByLabelText("Фильтры")).toBeNull();
    // Различающая здесь — проверка «Фильтры»: список пуст и без утечки, потому что режим «Журнал»
    // списка не отбирает вовсе. Проверка списка стоит страховкой от обратного.
    expect(screen.queryByRole("list", { name: /Заклинания/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Реакции/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ }),
    ).toBeNull();
  });

  it("шапки ресурсов в журнале нет вовсе (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openJournal(user);

    // Ни ячеек, ни чисел боя, ни номера раунда: журнал отвечает, что уже случилось.
    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByLabelText("Чем платить")).toBeNull();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByText(/раунд/i)).toBeNull();
  });

  it("действующего в журнале нет: журнал — только записи (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, concentrating());

    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();

    await openJournal(user);

    expect(screen.queryByRole("button", { name: /Концентрация/ })).toBeNull();
    expect(screen.queryByLabelText("Действует")).toBeNull();
  });
});

describe("шапка ресурсов принадлежит «Игре», а не приложению (FR-217)", () => {
  it("в «Книге» шапки ресурсов нет вовсе (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inCombat = within(screen.getByLabelText("Ресурсы"));
    expect(inCombat.getByLabelText("Чем платить")).toBeDefined();
    expect(inCombat.getByRole("button", { name: /^КД/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^Книга/ }));

    // Книга отвечает, что персонаж знает, а не чем он за это заплатит: ни ячеек, ни чисел боя.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText("Чем платить")).toBeNull();
    expect(screen.queryByText("КД")).toBeNull();
  });
});

describe("полоса обновления (FR-325)", () => {
  /**
   * Единственная подмена здесь — платформа: регистрации работников в тестовом DOM нет вовсе, и
   * предложить обновиться не с чего. Свойство описывается заново, поэтому за ним и убирают заново.
   */
  function updateWaits(): void {
    const registration = { waiting: { postMessage: () => {} }, addEventListener: () => {} };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: async () => registration, addEventListener: () => {}, controller: null },
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  /**
   * Чем полосе задано место: ближайший предок, назначающий ей край — экрана или соседа.
   *
   * Тестовый DOM разметку не раскладывает — стилей в нём нет, — поэтому «стоит над панелью»
   * читается по самому месту, а не по измеренным координатам.
   */
  function placeOf(node: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = node;
    while (current !== null) {
      if ([...current.classList].some((name) => name.startsWith("bottom-"))) return current;
      current = current.parentElement;
    }
    return null;
  }

  it("полоса обновления не закрывает панель режимов", async () => {
    updateWaits();
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const bar = await screen.findByRole("status");
    const panel = screen.getByRole("navigation", { name: "Режим экрана" });
    const place = placeOf(bar);

    // Нижний край полосы — верхний край панели: высота панели приходит от самой панели, а числом
    // она разъехалась бы с ней на первой же правке ряда ячеек.
    expect(place?.classList.contains("bottom-full")).toBe(true);
    expect(place?.parentElement?.contains(panel)).toBe(true);
    expect(place?.contains(panel)).toBe(false);

    // Пока полоса висит, навигация работает: другой у приложения нет.
    await user.click(screen.getByRole("button", { name: /^Журнал/ }));
    expect(selected("Журнал")).toBe(true);
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
  });

  it("«Позже» убирает полосу до следующего запуска", async () => {
    updateWaits();
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const bar = await screen.findByRole("status");
    await user.click(within(bar).getByRole("button", { name: "Позже" }));

    // Предложение, от которого нельзя отказаться, за столом читается как поломка: приходит оно в
    // начале вечера, а перезагрузка посреди боя стоит хода.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: /^Игра/ })).toBeDefined();
  });
});

describe("нечитаемое сохранение вместо режимов (FR-311)", () => {
  it("оболочка отдаёт выход, а не текст без кнопок", async () => {
    renderOn(await createStoresOverUnreadableSave(), <PlayShell />);

    // Играть не на чем: панели режимов нет, а нажать есть что.
    expect(screen.queryByRole("button", { name: /^Игра/ })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/повреждено/);
    expect(screen.getByRole("button", { name: "Скачать файл" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Начать заново" })).toBeDefined();
  });
});
