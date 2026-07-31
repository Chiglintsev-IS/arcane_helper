// @vitest-environment jsdom

/**
 * Блок концентрации (FR-084) на настоящем состоянии и настоящих операциях: моков нет.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores } from "@/testing/stores";

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
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

describe("карточка концентрации в шапке (FR-082, FR-084)", () => {
  it("без концентрации показывает, что её нет", async () => {
    await renderWithStores(<CombatScreen />);

    expect(within(screen.getByLabelText("Концентрация")).getByText(/Концентрации нет/)).toBeDefined();
  });

  it("показывает название, ячейку, механику и чем сорвётся", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    const block = screen.getByLabelText("Концентрация");
    expect(within(block).getByText("Обнаружение магии")).toBeDefined();
    expect(within(block).getByText(/ячейка 1 ур\./)).toBeDefined();
    expect(within(block).getByText(/Сфера 30 футов от себя · без спасброска/)).toBeDefined();
    expect(within(block).getByText(/спасбросок Телосложения \+4, КС от 10/)).toBeDefined();
  });

  it("карточка нажимаема и ведёт к подробностям", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    const card = screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
    await userEvent.click(card);

    expect(screen.getByRole("dialog", { name: /Концентрация/ })).toBeDefined();
  });
});

describe("лист концентрации (FR-084, FR-091)", () => {
  async function openPanel(): Promise<void> {
    await renderWithStores(<CombatScreen />, concentrating());
    await userEvent.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
  }

  it("объясняет, как работает и чем прерывается", async () => {
    await openPanel();

    const panel = screen.getByRole("dialog", { name: /Концентрация/ });
    expect(within(panel).getByText(/до 10 минут \(100 раундов\)/)).toBeDefined();
    expect(within(panel).getByText(/чувствует магию/)).toBeDefined();

    const breakers = within(panel).getByLabelText("Чем прерывается");
    expect(within(breakers).getAllByRole("listitem")).toHaveLength(6);
    expect(within(breakers).getByText(/Недееспособность или смерть/)).toBeDefined();
    expect(within(breakers).getByText(/На усмотрение мастера/)).toBeDefined();
  });

  it("ведёт к полной карточке заклинания", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: /Полные правила/ }));

    expect(screen.getByRole("dialog", { name: /Заклинание «Обнаружение магии»/ })).toBeDefined();
  });

  it("снимает концентрацию вручную и пишет это в журнал", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Отменить: Концентрация завершена: снята вручную/ }),
    ).toBeDefined();
  });
});

describe("ввод урона (FR-083, FR-180, FR-183)", () => {
  it("списывает хиты и без активной концентрации", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("48/60")).toBeDefined();
    expect(screen.queryByText(/Проверка концентрации/)).toBeNull();
  });

  it("отмечает подавление особенностей огнём", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "5");
    await userEvent.click(screen.getByLabelText("Урон огнём"));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText(/Особенности подавлены: урон огнём/)).toBeDefined();
  });

  it("при активной концентрации предлагает проверку с готовой КС", async () => {
    await renderWithStores(<CombatScreen />, concentrating());

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const check = screen.getByRole("dialog", { name: "Проверка концентрации" });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
    expect(within(check).getByText(/нужно 8 и выше/)).toBeDefined();
  });

  it("не принимает ноль и не пишет пустую запись", async () => {
    await renderWithStores(<CombatScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("60/60")).toBeDefined();
  });
});

describe("проверка концентрации (FR-083, FR-154)", () => {
  async function damage(amount: string, character: CharacterState = concentrating()): Promise<void> {
    await renderWithStores(<CombatScreen />, character);
    await userEvent.click(screen.getByRole("button", { name: "Получил урон" }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), amount);
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));
  }

  it("успех оставляет концентрацию и не пишет запись", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Успех" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();
    // Последняя запись журнала — урон, а не результат проверки.
    expect(screen.getByRole("button", { name: /Отменить: Получено урона: 24/ })).toBeDefined();
  });

  it("провал при доступной руне сначала предлагает Знаки ограждения", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Знаки ограждения/)).toBeDefined();
    // Эффект ещё держится: предложение обязано появиться до завершения (FR-154).
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    // Учёт хода включён: без него шапка показывает всё доступным, и трату реакции не видно
    // (deriveTurnEconomy). Сама трата происходит в обоих режимах — она в состоянии и в журнале.
    const character = concentrating();
    character.turnTracking = { enabled: true, actionAvailable: true, bonusActionAvailable: true };
    await damage("24", character);
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByText(/Руны 2\/3/)).toBeDefined();
    expect(screen.getByLabelText(/Реакция израсходована/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Отменить: Знаки ограждения/ }),
    ).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: /Отменить: Концентрация завершена: провалена проверка концентрации/,
      }),
    ).toBeDefined();
  });

  it("без руны провал завершает концентрацию сразу", async () => {
    const character = concentrating();
    character.runes = { remaining: 0, maximum: 3 };
    await damage("24", character);

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Концентрации нет/)).toBeDefined();
  });
});

describe("завершение активного эффекта (FR-091)", () => {
  it("закрывает неконцентрационный эффект и пишет это в журнал", async () => {
    const character = createThorne();
    character.activeEffects = [
      {
        id: "effect-2",
        spellId: "mage-armor",
        nameRu: "Доспехи мага",
        type: "buff",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "hours", value: 8 },
        isConcentration: false,
        slotLevelUsed: 1,
        endConditionRu: "До истечения длительности.",
      },
    ];
    await renderWithStores(<CombatScreen />, character);

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Доспехи мага" }));

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Доспехи мага/ }),
    ).toBeDefined();
  });
});
