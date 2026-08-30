// @vitest-environment jsdom

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

const IN_FIGHT = { inFight: true } as const;

async function inBookMode(character?: CharacterState) {
  const user = userEvent.setup();
  const result = await renderWithStores(<PlayShell initialMode="book" />, character);
  return { user, ...result };
}

async function openMode(
  user: ReturnType<typeof userEvent.setup>,
  title: RegExp,
): Promise<void> {
  await user.click(screen.getByRole("button", { name: /Режимы$/ }));
  await user.click(within(screen.getByRole("dialog", { name: "Режимы" })).getByRole("button", { name: title }));
}

async function openLog(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await openMode(user, /^Лог/);
}

async function openSheet(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await openMode(user, /^Лист/);
}

function wounded(): CharacterState {
  return withDamage(createThorne(), 48);
}

function withBonusActionSpell(): CharacterState {
  const hurt = withDamage(createThorne(), 30);
  return { ...hurt, preparedSpellIds: [...hurt.preparedSpellIds, "arcane-vigor"] };
}

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

function selected(title: string): boolean {
  return screen.getByRole("button", { name: /Режимы$/ }).textContent?.startsWith(title) === true;
}

/** Тестовый DOM разметку не раскладывает: поля читаются по классу отступа, а не по ширине. */
function gutterOfHeader(): string {
  let node = screen.getByLabelText("Ресурсы").parentElement;
  while (node !== null) {
    const gutter = [...node.classList].find((name) => name.startsWith("px-"));
    if (gutter !== undefined) return gutter;
    node = node.parentElement;
  }
  return "";
}

function badgeRow(): string[] {
  return within(screen.getByLabelText("Прочие ресурсы"))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

async function openPanel(): Promise<void> {
  await renderWithStores(<PlayShell />, concentrating());
  await userEvent.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));
}

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

    await openMode(user, /^Вещи/);

    expect(localStorage.getItem(STORAGE_KEY)).toBe("things");
  });

  it("битое значение читается как отсутствующее и открывает «Игру»", async () => {
    localStorage.setItem(STORAGE_KEY, "combat");

    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
  });

  it("панель — одна кнопка, и любой из восьми режимов стоит одного выбора (FR-204)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const panel = within(screen.getByRole("navigation", { name: "Режим экрана" }));
    expect(panel.getAllByRole("button")).toHaveLength(1);
    expect(panel.getByRole("button", { name: /Режимы$/ }).textContent).toContain("Игра");

    await openMode(user, /^Привал/);
    expect(screen.getByRole("button", { name: /Режимы$/ }).textContent).toContain("Привал");

    await openSheet(user);
    expect(screen.getByRole("tab", { name: "Броски" })).toBeDefined();
  });

  it("недоступное хранилище не мешает открыться", async () => {
    const unavailable = (): never => {
      throw new Error("SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(unavailable);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(unavailable);
    const user = userEvent.setup();

    await renderWithStores(<PlayShell />);
    await openMode(user, /^Книга/);

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
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByRole("button", { name: /^КД 17/ })).toBeDefined();

    await openMode(user, /^Лог/);
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));
    expect(screen.queryByText(/Доспехи мага · КД/)).toBeNull();

    await openMode(user, /^Игра/);
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();
  });
});

describe("режимы экрана (FR-200, FR-201, FR-204)", () => {
  it("начинает с «Игры» и показывает всё творимое сейчас (FR-209)", async () => {
    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.getByText("Сигнал тревоги")).toBeDefined();
  });

  it("режим попадает в состояние, а лог не засоряет (FR-204)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await openMode(user, /^Книга/);

    expect(shown(stores).log).toHaveLength(0);
  });

  it("«Ритуал» спрашивает про способ, а не про признак записи (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
    await openMode(user, /^Книга/);
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();

    await openMode(user, /^Игра/);
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openMode(user, /^Книга/);
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
  });

  it("шапка одинакова в «Игре» и «Привале»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inGame = gutterOfHeader();

    await openMode(user, /^Привал/);

    expect(inGame).not.toBe("");
    expect(gutterOfHeader()).toBe(inGame);
  });

  it("ряд значков одинаков во всех режимах, где он есть", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, withBonusActionSpell(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /^Мистическая бодрость/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "1d6" }));
    await user.type(screen.getByLabelText("Что выпало на 1d6"), "4");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const inGame = badgeRow();

    await openMode(user, /^Привал/);

    expect(inGame.join(" ")).toContain("Бонусное");
    expect(badgeRow()).toEqual(inGame);
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
    await openMode(user, /^Лог/);
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));
    expect(shown(stores).resources.runes.remaining).toBe(3);
  });
});

describe("выгрузка и загрузка (FR-120, FR-121, FR-122)", () => {
  it("«Данные» живут в «Логе» (FR-222)", async () => {
    await renderWithStores(<PlayShell />);
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await inBookMode();
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await renderWithStores(<PlayShell initialMode="log" />);
    expect(screen.getByRole("button", { name: "Данные" })).toBeDefined();
  });
});

describe("подготовка в «Книге» (FR-214, FR-101)", () => {
  it("подготовленное появляется в боевом списке (FR-209)", async () => {
    const user = userEvent.setup();
    await inBookMode();

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Крепость интеллекта" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    await openMode(user, /^Игра/);

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Обнаружение магии")).toBeDefined();
    expect(list.queryByText("Крепость интеллекта")).toBeNull();
  });

  it("отказ по лимиту не двигает список (FR-101)", async () => {
    const { user } = await inBookMode();

    const counter = screen.getByLabelText(/^Подготовлено \d+ из \d+/);
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));

    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBe(counter);
    expect(counter.textContent).toContain("Снимите другое заклинание");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("конец боя (FR-216, FR-221)", () => {
  it("переход между привалом и книгой вопроса не задаёт: бой уже позади", async () => {
    const user = userEvent.setup();
    const character = wounded();
    await renderWithStores(<PlayShell />, character);

    await openMode(user, /^Книга/);
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("угол карточки занимает роль во всех режимах (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inFight = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inFight.getByText(/Боевое/)).toBeDefined();

    await openMode(user, /^Книга/);

    const inBook = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inBook.getByText(/Боевое/)).toBeDefined();
  });
});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("учёт хода следует из отметки боя, а не из вкладки (FR-143)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    expect(screen.queryByRole("button", { name: "Учёт хода" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(screen.getByLabelText("Действие израсходовано")).toBeDefined();

    await openMode(user, /^Книга/);
    await openMode(user, /^Игра/);
    expect(screen.getByLabelText("Действие израсходовано")).toBeDefined();
  });
});

describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("строка руны есть в «Игре», но не в «Книге» (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    expect(screen.getByRole("button", { name: /Знаки ограждения/ })).toBeDefined();

    await openMode(user, /^Книга/);
    expect(screen.queryByRole("button", { name: /Знаки ограждения/ })).toBeNull();

    await openMode(user, /^Игра/);
    expect(screen.getByRole("button", { name: /Знаки ограждения/ })).toBeDefined();
  });
});

describe("режим «Лог» (FR-114, FR-220)", () => {
  it("в «Игре» и «Книге» кнопки отмены нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();

    await openMode(user, /^Книга/);
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();
  });

  it("переключение в «Лог» показывает записи", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openLog(user);

    expect(
      within(screen.getByRole("list", { name: "Лог событий" })).getByText(/Бой начался/),
    ).toBeDefined();
  });

  it("отмена из лога возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(slotsLeft(stores, 1)).toBe(3);

    await openLog(user);
    await user.click(screen.getByRole("button", { name: /^Вернуть/ }));

    expect(slotsLeft(stores, 1)).toBe(4);
    expect(screen.getByRole("button", { name: "Вернуть: Бой начался" })).toBeDefined();
  });
});

describe("одно дело — одно слово (FR-264)", () => {
  it("правка листа сохраняется, случившееся за столом подтверждается", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    const events = within(screen.getByRole("dialog", { name: "Хиты" }));
    expect(events.getByRole("button", { name: "Подтвердить" })).toBeDefined();
    expect(events.queryByRole("button", { name: "Сохранить" })).toBeNull();
    await user.click(events.getByRole("button", { name: "Отмена" }));

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /^Интеллект 18/ }));
    const record = within(screen.getByRole("dialog", { name: "Правка: Интеллект" }));
    expect(record.getByRole("button", { name: "Сохранить" })).toBeDefined();
    expect(record.queryByRole("button", { name: "Подтвердить" })).toBeNull();
  });

  it("дверь названа одним словом снаружи и внутри", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(
      screen.getByRole("button", {
        name: "Хиты 60/60. Что случилось: урон, лечение, временные, максимум",
      }),
    );
    expect(screen.getByRole("dialog", { name: "Хиты" })).toBeDefined();
    expect(screen.getByText("Что случилось?")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await user.click(screen.getByRole("button", { name: "КД 14. Поправка" }));
    expect(screen.getByRole("dialog", { name: "КД" })).toBeDefined();
    expect(screen.getByLabelText("Поправка")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await openMode(user, /^Вещи/);
    const money = screen.getByRole("button", { name: "Правка: Деньги" });
    expect(money.textContent).toBe("Правка");
    await user.click(money);
    expect(screen.getByRole("dialog", { name: "Правка: Деньги" })).toBeDefined();
  });

  it("уход со шторки и возврат сделанного зовутся по-разному", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openLog(user);

    expect(screen.getByRole("button", { name: "Вернуть: Бой начался" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Отмен/ })).toBeNull();
  });
});

describe("лист концентрации (FR-084, FR-091)", () => {
  it("снимает концентрацию вручную и пишет это в лог", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();

    await openMode(userEvent.setup(), /^Лог/);
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

    await openMode(userEvent.setup(), /^Лог/);
    expect(screen.getByRole("button", { name: /Вернуть: Получено урона: 24/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    const character = concentrating();
    await damage("24", character, { inFight: true });
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByLabelText("Ресурсы").textContent).toContain("2/3");
    expect(screen.getByLabelText("Реакция израсходована")).toBeDefined();

    await openMode(userEvent.setup(), /^Лог/);
    expect(
      screen.getByRole("button", { name: /Вернуть: Знаки ограждения/ }),
    ).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();

    await openMode(userEvent.setup(), /^Лог/);
    expect(
      screen.getByRole("button", {
        name: /Вернуть: Концентрация завершена: провалена проверка концентрации/,
      }),
    ).toBeDefined();
  });
});

describe("завершение активного эффекта (FR-091)", () => {
  it("закрывает неконцентрационный эффект и пишет это в лог", async () => {
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

    await openMode(userEvent.setup(), /^Лог/);
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
    expect(field.value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: /^Действует: Опутанный/ }));
    await userEvent.click(screen.getByRole("button", { name: "Завершить: Опутанный" }));
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.getByRole("button", { name: "Действует: ничего" })).toBeDefined();

    await openMode(userEvent.setup(), /^Лог/);
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
    await openMode(user, /^Привал/);

    const shortRest = screen.getByRole("button", {
      name: "Короткий отдых · 10 минут Пока идёт бой, короткий отдых недоступен: 10 минут между двумя ходами не проходят",
    });
    expect(shortRest.hasAttribute("disabled")).toBe(true);

    const longRest = screen.getByRole("button", { name: "Долгий отдых Пока идёт бой, долгий отдых недоступен" });
    expect(longRest.hasAttribute("disabled")).toBe(true);

    const recovery = screen.getByRole("button", {
      name: /^Магическое восстановление .* Пока идёт бой, магическое восстановление недоступно$/,
    });
    expect(recovery.hasAttribute("disabled")).toBe(true);
  });

  it("отключённая кнопка отдыха не меняет состояние по клику (FR-215)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openMode(user, /^Привал/);
    await user.click(
      screen.getByRole("button", { name: "Долгий отдых Пока идёт бой, долгий отдых недоступен" }),
    );

    expect(shown(stores).log.at(-1)?.kind).not.toBe("long_rest");
    expect(screen.queryByRole("dialog", { name: "Долгий отдых?" })).toBeNull();
  });
});

describe("экран показывает только своё (FR-217, FR-220)", () => {
  it("списка, фильтров и отметок схватки в логе нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, createThorne(), IN_FIGHT);
    await openLog(user);

    expect(screen.queryByLabelText("Фильтры")).toBeNull();
    expect(screen.queryByRole("list", { name: /Заклинания/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Реакции/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ }),
    ).toBeNull();
  });

  it("шапки ресурсов в логе нет вовсе (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await openLog(user);

    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ячейки 1 уровня/ })).toBeNull();
    expect(screen.queryByLabelText("Прочие ресурсы")).toBeNull();
    expect(screen.queryByText(/раунд/i)).toBeNull();
  });

  it("действующего в логе нет: лог — только записи (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />, concentrating());

    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();

    await openLog(user);

    expect(screen.queryByRole("button", { name: /Концентрация/ })).toBeNull();
    expect(screen.queryByLabelText("Действует")).toBeNull();
  });
});

describe("шапка ресурсов принадлежит «Игре», а не приложению (FR-217)", () => {
  it("в «Книге» шапки ресурсов нет вовсе (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const inCombat = within(screen.getByLabelText("Ресурсы"));
    expect(inCombat.getByRole("button", { name: /Ячейки 1 уровня/ })).toBeDefined();
    expect(inCombat.getByRole("button", { name: /^КД/ })).toBeDefined();

    await openMode(user, /^Книга/);

    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ячейки 1 уровня/ })).toBeNull();
    expect(screen.queryByText("КД")).toBeNull();
  });
});

describe("полоса обновления (FR-325)", () => {
  /** Регистрации работников в тестовом DOM нет вовсе: свойство описывается и убирается заново. */
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

  /** Тестовый DOM разметку не раскладывает: место читается по классу, а не по координатам. */
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

    expect(place?.classList.contains("bottom-full")).toBe(true);
    expect(place?.parentElement?.contains(panel)).toBe(true);
    expect(place?.contains(panel)).toBe(false);

    await openMode(user, /^Лог/);
    expect(selected("Лог")).toBe(true);
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
  });

  it("«Позже» убирает полосу до следующего запуска", async () => {
    updateWaits();
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    const bar = await screen.findByRole("status");
    await user.click(within(bar).getByRole("button", { name: "Позже" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: /^Игра/ })).toBeDefined();
  });
});

describe("нечитаемое сохранение вместо режимов (FR-311)", () => {
  it("оболочка отдаёт выход, а не текст без кнопок", async () => {
    renderOn(await createStoresOverUnreadableSave(), <PlayShell />);

    expect(screen.queryByRole("button", { name: /^Игра/ })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/повреждено/);
    expect(screen.getByRole("button", { name: "Скачать файл" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Начать заново" })).toBeDefined();
  });
});
