// @vitest-environment jsdom

/**
 * «Экипировка» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Режим надеваемого: вещь заводится в запас, надевается со своей строки и двигает защиту там же,
 * где её надели.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, shown, testSnapshot } from "@/ui/app/testing/stores";
import { GearScreen } from "@/ui/screens/gear/ui/GearScreen";

/** Вещь со своим запасом так, как её показывает экран. */
function itemOf(stores: AppStores, id: string): ItemView | undefined {
  return shown(stores).bag.items.find((item) => item.id === id);
}

describe("«Экипировка» (FR-234, FR-249)", () => {
  it("«Экипировка»: надетая вещь двигает КД, снятая — возвращает (FR-234)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GearScreen />);

    const before = shown(stores).bag.armorClass.value;

    // Находка заводится одним названием, прямо в разделе запаса: подробности — по нажатию.
    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");

    // Вещь легла в запас: защита пока прежняя — лежащее не действует.
    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ bagCount: 1, wornCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before);

    await user.click(screen.getByRole("button", { name: "Открыть: Кольцо защиты" }));
    await user.selectOptions(screen.getByLabelText("Добавить прибавку"), "armorClass");
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    const armorField = screen.getByLabelText("Класс Доспеха");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 1, bagCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before + 1);
    // Персонаж при этом не тронут: вещь не меняет того, кто он.
    expect(shown(stores).sheet.abilities).toEqual(testSnapshot().sheet.abilities);

    // Снятое возвращает число и саму вещь в запас.
    const worn = within(screen.getByRole("list", { name: "На мне" }));
    await user.click(worn.getByRole("button", { name: "Снять один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 0, bagCount: 1 });
    expect(shown(stores).bag.armorClass.value).toBe(before);
  });
});
