// @vitest-environment jsdom

/**
 * Оболочка: переключатель режима, полоса ошибки и выбор режима, переживающий перезапуск.
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
import { renderWithStores } from "@/ui/app/testing/stores";
import { withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";

/** Бой отмечен начатым: только тогда ведётся учёт хода. */
const IN_FIGHT = { inFight: true } as const;

/** Рендер сразу в «Книге»: путь до неё проверяется отдельно, здесь она нужна как обстановка. */
async function inBookMode(character?: CharacterState) {
  const user = userEvent.setup();
  const result = await renderWithStores(<PlayShell initialMode="book" />, character);
  return { user, ...result };
}

/** Уйти в журнал: кнопка переключателя названа по режиму и подсказке. */
async function openJournal(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
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

/** Выбран ли режим: полоса помечает текущий, и это единственный признак на экране. */
function selected(title: string): boolean {
  return screen.getByRole("radio", { name: new RegExp(`^${title}`) }).getAttribute("aria-checked") === "true";
}

/** Лист концентрации открывается с карточки в шапке «Игры». */
async function openPanel(): Promise<void> {
  await renderWithStores(<PlayShell />, concentrating());
  await userEvent.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
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
  await userEvent.click(screen.getByRole("button", { name: "Записать" }));
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

    await user.click(screen.getByRole("radio", { name: /^Сумка/ }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("bag");
  });

  it("битое значение читается как отсутствующее и открывает «Игру»", async () => {
    // Значение приходит из чужих рук: прежняя версия, ручная правка, мусор в хранилище. Раньше
    // оно доходило до разбора режима как есть и не попадало ни в одну ветку — экран не рисовался.
    localStorage.setItem(STORAGE_KEY, "combat");

    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
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
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

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

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(within(screen.getByLabelText("Ресурсы")).getByText("17")).toBeDefined();

    // Отменяют только в журнале. Шапки там нет, но блок действующего есть: отмена уносит эффект,
    // и это видно на том же экране, где нажали кнопку.
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(screen.queryByText(/Доспехи мага · КД/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(within(screen.getByLabelText("Ресурсы")).getByText("14")).toBeDefined();
  });

});

describe("режимы экрана (FR-200, FR-201, FR-204)", () => {
  it("начинает с «Игры» и показывает всё творимое сейчас (FR-209)", async () => {
    await renderWithStores(<PlayShell />);

    expect(screen.getByRole("radio", { name: /^Игра/ })).toHaveProperty("ariaChecked", "true");
    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    // Пока бой не идёт, торопиться некуда: долгое накладывание и ритуал из книги на месте.
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.getByText("Поиск фамильяра")).toBeDefined();
  });

  it("режим попадает в состояние, а журнал не засоряет (FR-204)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    // Сохранение — да, запись в журнал — нет: режим меняет вид, отменять в нём нечего.
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("«Ритуал» спрашивает про способ, а не про признак записи (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    // Пока бой не идёт, ритуалом сотворить можно — переключатель на месте и в «Игре», и в «Книге».
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();

    // С началом боя способа нет нигде: ритуал занимает на десять минут больше обычного, и вкладка
    // этого не меняет.
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
  });

});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("руны правятся вручную и правка обратима (FR-111)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Потратить: Руны" }));
    expect(stores.session.getState().session?.character.runes.remaining).toBe(2);

    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    // Кнопка отмены живёт только в журнале — путь к ней длиннее на одно нажатие.
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(stores.session.getState().session?.character.runes.remaining).toBe(3);
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
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Обнаружение магии")).toBeDefined();
    expect(list.queryByText("Отражения")).toBeNull();
  });

  it("двенадцатое заклинание упирается в лимит и объясняет причину (FR-101)", async () => {
    const user = userEvent.setup();
    // В книге Торна восемь записей, а лимит 11 — до края не дотянуться. Понижаем Интеллект до 8:
    // лимит становится 6 (модификатор −1 плюс уровень 7), и шесть подготовленных его исчерпывают.
    const overloaded = {
      ...createThorne(),
      abilities: { ...createThorne().abilities, intelligence: 8 },
      preparedSpellIds: [...createThorne().spellbookSpellIds].slice(0, 6),
    };
    await renderWithStores(<PlayShell initialMode="book" />, overloaded);

    expect(screen.getByLabelText("Подготовлено 6 из 6")).toBeDefined();
    // Седьмое: подготовки нет ровно у двух записей книги, берём первую попавшуюся.
    await user.click(screen.getAllByRole("button", { name: /^Подготовить: / })[0]!);

    expect(screen.getByRole("alert").textContent).toContain("Подготовлено 6 из 6");
  });

});

describe("конец боя (FR-216, FR-221)", () => {
  it("переход между привалом и книгой вопроса не задаёт: бой уже позади", async () => {
    const user = userEvent.setup();
    const character = wounded();
    await renderWithStores(<PlayShell />, character);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });

});

describe("краткая карточка (FR-010)", () => {
  it("угол карточки занимает роль во всех режимах (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inFight = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inFight.getByText("Боевое")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

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

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();

    // Уход в «Книгу» на учёт не влияет: признак приходит из журнала, а не из вкладки.
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
  });

});

describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("кнопка «Реакции» есть в «Игре», но не в «Книге» (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();

    // «Книга» — не место для реакции: её открывают заранее, а не в чужой ход.
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();
  });

});

describe("режим «Журнал» (FR-114, FR-220)", () => {
  it("в «Игре» и «Книге» кнопки отмены нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });

  it("переключение в «Журнал» показывает записи", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
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
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);

    await openJournal(user);
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    // Экран не закрылся: кнопка переехала на запись «Бой начался», и её тоже можно отменить.
    expect(screen.getByRole("button", { name: "Отменить: Бой начался" })).toBeDefined();
  });

});

describe("лист концентрации (FR-084, FR-091)", () => {
  it("снимает концентрацию вручную и пишет это в журнал", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Концентрация завершена: снята вручную/ }),
    ).toBeDefined();
  });

});

describe("проверка концентрации (FR-083, FR-154)", () => {
  it("успех оставляет концентрацию и не пишет запись", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Успех" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    // Последняя запись журнала — урон, а не результат проверки.
    expect(screen.getByRole("button", { name: /Отменить: Получено урона: 24/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    // Бой отмечен начатым — значит учёт хода ведётся и трата реакции видна в шапке.
    const character = concentrating();
    await damage("24", character, { inFight: true });
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByText(/Руны 2\/3/)).toBeDefined();
    // Значок траты реакции есть только в бою — он проверяется до ухода в журнал.
    expect(screen.getByLabelText(/Реакция израсходована/)).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Знаки ограждения/ }),
    ).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", {
        name: /Отменить: Концентрация завершена: провалена проверка концентрации/,
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

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Доспехи мага" }));

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Доспехи мага/ }),
    ).toBeDefined();
  });

});

describe("ручной статус (FR-236)", () => {
  it("заводит статус без вклада в КД и его можно снять", async () => {
    await renderWithStores(<PlayShell />);

    const field = screen.getByLabelText<HTMLInputElement>("Новый статус");
    await userEvent.type(field, "Опутанный{Enter}");

    const list = screen.getByLabelText("Активные эффекты");
    expect(within(list).getByText(/Опутанный/)).toBeDefined();
    expect(within(list).queryByText(/КД/)).toBeNull();
    // Поле готово к следующему статусу без лишнего нажатия.
    expect(field.value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Опутанный" }));
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    // Отменить можно только последнюю запись — снятие эффекта; начало осталось строкой без кнопки.
    expect(screen.getByText("Эффект начат: Опутанный")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Опутанный/ }),
    ).toBeDefined();
  });

});

describe("отдых и бой: отказ приходит с причиной (FR-215)", () => {
  it("«Привал» остаётся доступным в бою, а отдых отказывает с причиной, а не пропадает (FR-215)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    // Мода не спрашивает про бой: переключатель режима работает в бою так же, как вне его.
    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    const shortRest = screen.getByRole("button", {
      name: "Короткий отдых · час — Не проходит во время боя",
    });
    expect(shortRest.hasAttribute("disabled")).toBe(true);

    const longRest = screen.getByRole("button", { name: "Долгий отдых — Не проходит во время боя" });
    expect(longRest.hasAttribute("disabled")).toBe(true);

    // Подпись несёт ещё и остаток дневного бюджета, поэтому имя проверяется началом и причиной.
    const recovery = screen.getByRole("button", {
      name: /^Магическое восстановление .* — Не проходит во время боя$/,
    });
    expect(recovery.hasAttribute("disabled")).toBe(true);
  });

  it("отключённая кнопка отдыха не меняет состояние по клику (FR-215)", async () => {
    // Защита в два слоя: кнопка выключена атрибутом `disabled`, а сценарий отказал бы и без него.
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("radio", { name: /^Привал/ }));
    await user.click(
      screen.getByRole("button", { name: "Долгий отдых — Не проходит во время боя" }),
    );

    expect(stores.session.getState().session?.journal.at(-1)?.kind).not.toBe("long_rest");
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
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ }),
    ).toBeNull();
  });

  it("шапки ресурсов в журнале нет вовсе (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await openJournal(user);

    // Ни ячеек, ни чисел боя, ни номера раунда: журнал отвечает, что уже случилось.
    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByText(/Раунд/)).toBeNull();
  });

  it("действующего в журнале нет: журнал — только записи (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, concentrating());

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();

    await openJournal(user);

    expect(screen.queryByRole("button", { name: /Концентрация/ })).toBeNull();
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });
});

describe("шапка ресурсов принадлежит «Игре», а не приложению (FR-217)", () => {
  it("в «Книге» шапки ресурсов нет вовсе (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inCombat = within(screen.getByLabelText("Ресурсы"));
    expect(inCombat.getByLabelText("Ячейки заклинаний")).toBeDefined();
    expect(inCombat.getByRole("button", { name: /^КД/ })).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    // Книга отвечает, что персонаж знает, а не чем он за это заплатит: ни ячеек, ни чисел боя.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByText("КД")).toBeNull();
  });
});
