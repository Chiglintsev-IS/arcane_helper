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
