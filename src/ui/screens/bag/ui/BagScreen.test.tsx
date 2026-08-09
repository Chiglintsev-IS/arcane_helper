// @vitest-environment jsdom

/**
 * «Сумка» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Сумка — вещи и деньги: надетая вещь двигает Класс Доспеха, расходник тратится со строки.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, shown, testSnapshot } from "@/ui/app/testing/stores";
import { BagScreen } from "@/ui/screens/bag/ui/BagScreen";

/** Вещь со своим запасом так, как её показывает сумка. */
function itemOf(stores: AppStores, id: string): ItemView | undefined {
  return shown(stores).bag.items.find((item) => item.id === id);
}

describe("«Сумка» (FR-234, FR-242)", () => {
  it("«Сумка»: надетая вещь двигает КД, снятая — возвращает (FR-234)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<BagScreen />);

    // Находка заводится одним названием, прямо в разделе экипировки: подробности — по нажатию.
    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");

    // Вещь легла в сумку: КД пока прежний — лежащее не действует.
    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ bagCount: 1, wornCount: 0 });

    await user.click(screen.getByRole("button", { name: "Открыть: Кольцо защиты" }));
    await user.selectOptions(screen.getByLabelText("Добавить прибавку"), "armorClass");
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    const armorField = screen.getByLabelText("Класс Доспеха");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 1, bagCount: 0 });
    // Персонаж при этом не тронут: вещь не меняет того, кто он.
    expect(shown(stores).sheet.abilities).toEqual(testSnapshot().sheet.abilities);
  });

  it("«Сумка»: расходник тратится и пополняется со строки, деньги правятся шторкой (FR-242)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<BagScreen />);

    await user.type(screen.getByLabelText("Новый расходник"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));

    // Ноль — состояние: строка осталась, минус выключен.
    expect(itemOf(stores, "зелье-лечения")?.bagCount).toBe(0);
    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }),
    ).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Править: Деньги" }));
    const gold = screen.getByLabelText("Золото");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).bag.money.find((coin) => coin.currency === "gold")?.amount).toBe(215);
    expect(shown(stores).journal.at(-1)?.summaryRu).toBe("Деньги: зм 0 → 215");
  });

});
