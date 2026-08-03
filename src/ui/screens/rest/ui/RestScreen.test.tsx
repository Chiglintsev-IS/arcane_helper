// @vitest-environment jsdom

/**
 * «Привал» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Экран проверяется сам по себе, без оболочки: шторки принадлежат ему, и открывать их обязан он, а
 * не общий слой поверх приложения.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores } from "@/ui/app/testing/stores";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";

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

describe("шторки «Привала» (FR-205, FR-237)", () => {
  it("плитка КД открывает правку поправки и доводит её до итога", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^КД 14/ }));
    const sheet = screen.getByRole("dialog", { name: "Правка КД" });
    await user.type(within(sheet).getByLabelText("Поправка"), "2");
    await user.click(within(sheet).getByRole("button", { name: "Записать" }));

    expect(screen.queryByRole("dialog", { name: "Правка КД" })).toBeNull();
    expect(screen.getByRole("button", { name: /^КД 16/ })).toBeDefined();
  });

  it("плитка хитов открывает правку урона и списывает хиты", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "12");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("48/60")).toBeDefined();
  });

  it("плитка ячейки открывает ручную правку ресурсов", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Ячейки 1 уровня/ }));
    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });
    await user.click(within(sheet).getByRole("button", { name: "Потратить: Ячейка 1 ур." }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("карточка концентрации открывает лист и снимает концентрацию", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
    const panel = screen.getByRole("dialog", { name: "Концентрация: Обнаружение магии" });
    await user.click(within(panel).getByRole("button", { name: "Снять концентрацию" }));

    expect(stores.session.getState().session?.character.concentration).toBeUndefined();
  });

  it("перехода к полным правилам на «Привале» нет: подробная карточка живёт в других режимах", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));

    expect(screen.queryByRole("button", { name: /Полные правила/ })).toBeNull();
  });

  it("урон, полученный на привале, предлагает проверку концентрации", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "24");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    const check = screen.getByRole("dialog", { name: "Проверка концентрации" });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
  });

  it("провал проверки снимает концентрацию с привала так же, как из боя", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "24");
    await user.click(screen.getByRole("button", { name: "Записать" }));
    // Руна и реакция на месте, поэтому провал сначала предлагает «Знаки ограждения».
    await user.click(screen.getByRole("button", { name: "Провал" }));
    await user.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(stores.session.getState().session?.character.concentration).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();
  });
});
