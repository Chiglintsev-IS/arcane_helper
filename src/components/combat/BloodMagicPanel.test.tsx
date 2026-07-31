// @vitest-environment jsdom

/**
 * Кровавое колдовство проверяется на настоящих операциях состояния: цена крови — единственное место,
 * где ошибка стоит игроку здоровья персонажа (OQ-15).
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores } from "@/testing/stores";

async function openPanel(character?: CharacterState) {
  const user = userEvent.setup();
  const rendered =
    character === undefined
      ? await renderWithStores(<CombatScreen />)
      : await renderWithStores(<CombatScreen />, character);
  await user.click(screen.getByRole("button", { name: /Магия крови/ }));
  return { user, ...rendered };
}

describe("обмен хитов на очки (FR-170, FR-171, FR-172)", () => {
  it("называет цену каждого уровня хитами и очками", async () => {
    await openPanel();
    const exchange = screen.getByLabelText("Обмен хитов на очки");

    // Курс ступени 5–8 — 3 хита за очко, подтверждён игроком (OQ-15).
    expect(within(exchange).getByText(/Ячейка 1 уровня — 6 хитов за 2 очка/)).toBeDefined();
    expect(within(exchange).getByText(/Ячейка 2 уровня — 9 хитов за 3 очка/)).toBeDefined();
    expect(within(exchange).getByText(/Ячейка 4 уровня — 18 хитов за 6 очков/)).toBeDefined();
  });

  it("списывает хиты и максимум, начисляет очки и тратит действие", async () => {
    const { user, stores } = await openPanel();

    await user.click(screen.getByRole("button", { name: /Ячейка 1 уровня/ }));

    const character = stores.session.getState().session?.character;
    expect(character?.hitPoints).toEqual({ current: 54, maximum: 54, maximumReduction: 6 });
    expect(character?.spellPoints.remaining).toBe(2);
    expect(stores.session.getState().session?.journal.at(-1)?.actionUsed).toBe("action");
  });

  it("предупреждает о ранах, если обмен опустит хиты в ноль (FR-175)", async () => {
    const dying = createThorne();
    dying.hitPoints = { current: 5, maximum: 60, maximumReduction: 0 };
    await openPanel(dying);

    const exchange = screen.getByLabelText("Обмен хитов на очки");
    expect(within(exchange).getByText(/Уйдёт в ноль хитов: 1 рана/)).toBeDefined();
  });
});

describe("восстановление максимума (FR-173)", () => {
  it("возвращает по три за час и не больше утраченного", async () => {
    const { user, stores } = await openPanel();
    await user.click(screen.getByRole("button", { name: /Ячейка 1 уровня/ }));

    await user.click(screen.getByRole("button", { name: "Прошёл час" }));
    expect(stores.session.getState().session?.character.hitPoints).toEqual({
      current: 54,
      maximum: 57,
      maximumReduction: 3,
    });

    await user.click(screen.getByRole("button", { name: "Прошёл час" }));
    const restored = stores.session.getState().session?.character.hitPoints;
    expect(restored).toEqual({ current: 54, maximum: 60, maximumReduction: 0 });
    expect(screen.getByRole("button", { name: "Прошёл час" }).hasAttribute("disabled")).toBe(true);
  });

  it("без снижения максимума кнопка недоступна и объясняет почему", async () => {
    await openPanel();
    expect(screen.getByRole("button", { name: "Прошёл час" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Максимум не снижен/)).toBeDefined();
  });
});

describe("подавление особенностей (FR-176, FR-180, FR-181)", () => {
  it("урон огнём подавляет обмен и восстановление до конца следующего хода", async () => {
    const { user, stores } = await openPanel();
    await user.click(screen.getByRole("button", { name: /Ячейка 1 уровня/ }));

    await user.type(screen.getByLabelText("Сколько"), "5");
    await user.click(screen.getByLabelText("Огнём"));
    await user.click(screen.getByRole("button", { name: "Отметить урон" }));

    expect(stores.session.getState().session?.character.hitPoints.current).toBe(49);
    expect(screen.getByText(/Подавлено уроном огнём/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Прошёл час" }).hasAttribute("disabled")).toBe(true);
  });

  it("солнечный свет переключается и подавляет особенности", async () => {
    const { user, stores } = await openPanel();

    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));
    expect(stores.session.getState().session?.character.suppression.underDirectSunlight).toBe(true);
    expect(screen.getByText(/Подавлено прямым солнечным светом/)).toBeDefined();
  });

  it("обмен под подавлением показывает причину, а не молчит", async () => {
    const { user, stores } = await openPanel();

    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));
    await user.click(screen.getByRole("button", { name: /Ячейка 1 уровня/ }));

    expect(stores.session.getState().session?.character.spellPoints.remaining).toBe(0);
    expect(stores.session.getState().error).toMatch(/солнечн/);
  });
});
