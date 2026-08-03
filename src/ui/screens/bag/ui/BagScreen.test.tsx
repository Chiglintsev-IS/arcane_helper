// @vitest-environment jsdom

/**
 * «Сумка» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Сумка — вещи и деньги: надетая вещь двигает Класс Доспеха, расходник тратится со строки.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores } from "@/ui/app/testing/stores";
import { BagScreen } from "@/ui/screens/bag/ui/BagScreen";

describe("«Сумка» (FR-234, FR-242)", () => {
  it("«Сумка»: надетая вещь двигает КД, снятая — возвращает (FR-234)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<BagScreen />);

    // Находка заводится одним названием, прямо в разделе экипировки: подробности — по нажатию.
    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");

    // Вещь легла в сумку: КД пока прежний — лежащее не действует.
    const carried = stores.session.getState().session?.character.equipment.items ?? [];
    expect(carried.find((item) => item.id === "кольцо-защиты")?.worn).toBe(false);

    await user.click(screen.getByRole("button", { name: "Открыть: Кольцо защиты" }));
    const armorField = screen.getByLabelText("К защите");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("switch", { name: "Надето: Кольцо защиты" }));

    const worn = stores.session.getState().session?.character;
    expect(worn?.equipment.items.find((item) => item.id === "кольцо-защиты")?.worn).toBe(true);
    // Персонаж при этом не тронут: вещь не меняет того, кто он.
    expect(worn?.abilities).toEqual(createThorne().abilities);
  });

  it("«Сумка»: расходник тратится и пополняется со строки, деньги правятся шторкой (FR-242)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<BagScreen />);

    await user.type(screen.getByLabelText("Новый расходник"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Добавить один: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один: Зелье лечения" }));

    // Ноль — состояние: строка осталась, минус выключен.
    const potion = stores.session
      .getState()
      .session?.character.equipment.items.find((item) => item.id === "зелье-лечения");
    expect(potion?.count).toBe(0);
    expect(
      screen.getByRole("button", { name: "Потратить один: Зелье лечения" }),
    ).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Править: Деньги" }));
    const gold = screen.getByLabelText("Золото");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(stores.session.getState().session?.character.equipment.money.gold).toBe(215);
    expect(stores.session.getState().session?.journal.at(-1)?.summaryRu).toBe("Деньги: зм 0 → 215");
  });

});
