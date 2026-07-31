// @vitest-environment jsdom

/**
 * Экран боя проверяется на настоящем состоянии и настоящих операциях: хранилище в памяти,
 * контент Торна, движок правил. Моков нет — иначе тест подтверждает поведение мока.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores, spell } from "@/testing/stores";
import { CombatScreen } from "./CombatScreen";

function withTurnTracking(): CharacterState {
  const character = createThorne();
  character.turnTracking = { enabled: true, actionAvailable: true, bonusActionAvailable: true };
  return character;
}

function concentrating(): CharacterState {
  const character = createThorne();
  character.concentration = { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" };
  character.activeEffects = [
    {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      type: "control",
      startedAt: "2026-07-31T18:00:00.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
    },
  ];
  return character;
}

describe("состав экрана (FR-001, AC-14)", () => {
  it("показывает персонажа, производные числа, ячейки, концентрацию и доступность реакции", async () => {
    await renderWithStores(<CombatScreen />);

    expect(screen.getByRole("heading", { name: "Торн" })).toBeDefined();
    expect(screen.getByText(/Волшебник, 7 уровень/)).toBeDefined();

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("16")).toBeDefined(); // КС спасброска
    expect(within(numbers).getByText("+8")).toBeDefined(); // атака заклинанием

    const slots = screen.getByLabelText("Ячейки заклинаний");
    expect(within(slots).getAllByRole("listitem")).toHaveLength(4);
    expect(within(slots).getByText("4/4")).toBeDefined();

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
    expect(screen.getByLabelText("Реакция доступна")).toBeDefined();
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
  });

  it("показывает активную концентрацию и условие её завершения", async () => {
    await renderWithStores(<CombatScreen />, concentrating());
    expect(screen.getByText(/Концентрация: «Обнаружение магии»/)).toBeDefined();
  });

  it("КД меняется после применения «Доспехов мага»: 14 → 17 (FR-093)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(within(numbers).getByText("17")).toBeDefined();
    // Вклад подписан на строке эффекта: игрок видит, откуда взялось новое число (OQ-19).
    expect(screen.getByText(/Доспехи мага · КД 17/)).toBeDefined();
  });

  it("отмена применения возвращает КД к 14", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("17")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Отменить/ }));
    expect(within(numbers).getByText("14")).toBeDefined();
  });

  it("на израсходованную реакцию отвечает «когда вернётся», а не «нет» (FR-144)", async () => {
    const character = withTurnTracking();
    character.reactionAvailable = false;
    const { stores } = await renderWithStores(<CombatScreen />, character);

    // Реакция считается потраченной по журналу: отмечаем её расход применением «Щита».
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.reactionAvailable).toBe(false);
    expect(screen.getByText(/вернётся в начале вашего хода/)).toBeDefined();
  });
});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("фильтр по времени накладывания оставляет только подходящие заклинания", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Поглощение стихий")).toBeDefined();
  });

  it("значения одной категории соединяются «или»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Действие" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });

  it("объясняет пустой результат и предлагает сброс, а не пустой экран", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Заговор" }));

    expect(screen.getByText(/не подходит ни одно заклинание/)).toBeDefined();
    expect(screen.getByText(/4 ритуалов скрыты как неподготовленные/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getByLabelText("Заклинания")).toBeDefined();
  });

  it("«доступно сейчас» согласовано с проверкой доступности мастера", async () => {
    const character = withTurnTracking();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, character);

    await user.click(screen.getByRole("button", { name: "Доступно сейчас" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).queryByText("Щит")).toBeNull();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("показывает оба названия, уровень, время, дальность и пересказ эффекта", async () => {
    await renderWithStores(<CombatScreen />);
    const row = screen.getByRole("button", { name: /Луч холода/ });

    expect(within(row).getByText("Ray of Frost")).toBeDefined();
    expect(within(row).getByText("Заговор")).toBeDefined();
    expect(within(row).getByText("Действие")).toBeDefined();
    expect(within(row).getByText("60 футов")).toBeDefined();
    expect(within(row).getByText(spell("ray-of-frost").shortRulesRu)).toBeDefined();
  });

  it("накладывание дольше хода называет точное время, а не категорию (FR-033)", async () => {
    await renderWithStores(<CombatScreen />);
    const row = screen.getByRole("button", { name: /Починка/ });

    expect(within(row).getByText("1 минута")).toBeDefined();
    expect(within(row).queryByText("Минуты")).toBeNull();
  });

  it("называет минимальную стоимость применения", async () => {
    await renderWithStores(<CombatScreen />);

    expect(
      within(screen.getByRole("button", { name: /Доспехи мага/ })).getByText("Ячейка от 1 ур."),
    ).toBeDefined();
    expect(
      within(screen.getByRole("button", { name: /Луч холода/ })).getByText("Без ячейки"),
    ).toBeDefined();
  });

  it("недоступное заклинание объясняет причину словами", async () => {
    // Ячейки 1 уровня не хватило бы: заклинание можно поднять до 4 уровня или оплатить кровью,
    // поэтому недоступным оно становится только когда не осталось ни одного способа.
    const character = withTurnTracking();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    await renderWithStores(<CombatScreen />, character);

    const row = screen.getByRole("button", { name: /Доспехи мага/ });
    expect(within(row).getByText(/Нет свободной ячейки 1 уровня/)).toBeDefined();
  });

  it("неподготовленный ритуал не объясняется подготовкой (FR-103)", async () => {
    // Ритуалу подготовка не нужна, и мастер применения предложит именно ритуал. Строка списка
    // обязана назвать ту же причину, иначе она отговаривает от способа, который работает.
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    const row = screen.getByRole("button", { name: /Обнаружение магии/ });
    expect(within(row).queryByText(/Заклинание не подготовлено/)).toBeNull();
    expect(within(row).getByText(/Уже идёт концентрация/)).toBeDefined();
  });
});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("«Мой ход начался» восстанавливает израсходованное", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />, withTurnTracking());

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(screen.getByText(/Действие израсходовано/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Мой ход начался" }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(stores.session.getState().session?.character.turnTracking.actionAvailable).toBe(true);
  });

  it("отмена возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);

    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("учёт хода переключается и обратим", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    const toggle = screen.getByRole("button", { name: "Учёт хода" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await user.click(toggle);
    expect(stores.session.getState().session?.character.turnTracking.enabled).toBe(true);
    expect(screen.getByRole("button", { name: "Учёт хода" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("подробная карточка (FR-011, FR-012)", () => {
  it("открывается по строке списка и показывает механику", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    // Неподготовленные ритуалы в боевом списке скрыты: показываем их фильтром (F-09).
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /Опознание/ }));

    const card = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(card).getByText(/Прорицание/)).toBeDefined();
    expect(
      within(card).getByText(new RegExp(spell("identify").components.materialText ?? "")),
    ).toBeDefined();
    expect(within(card).getByText(/фокусировка не заменяет/)).toBeDefined();
    expect(within(card).getByText("Броска нет: эффект применяется сразу")).toBeDefined();
  });

  it("полные правила и отыгрыш закрыты по умолчанию", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const card = screen.getByRole("dialog", { name: /Луч холода/ });

    const fullRules = within(card).getByText("Полные правила").closest("details");
    const roleplay = within(card).getByText("Отыгрыш").closest("details");
    expect(fullRules?.hasAttribute("open")).toBe(false);
    expect(roleplay?.hasAttribute("open")).toBe(false);
  });

  it("техническая инструкция доступна за два нажатия (M-02)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    await user.click(screen.getByText("Как объявить"));

    expect(screen.getByText(/Атака заклинанием, модификатор \+8/)).toBeDefined();
  });

  it("заметка сохраняется в состоянии и не попадает в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.type(screen.getByLabelText("Заметка"), "гасит и стрелу");

    expect(stores.session.getState().session?.character.spellNotes.shield).toBe("гасит и стрелу");
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });
});
