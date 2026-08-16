// @vitest-environment jsdom

/**
 * «Ремесло» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Режим знания: записанные виды и раскрытое у каждого. Порции того же вида лежат в сумке и сюда не
 * приходят — на два вопроса отвечают два режима, и второе место для одного числа расходилось бы с
 * первым молча.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { createTestStores, renderOn, renderWithStores, shown } from "@/ui/app/testing/stores";
import { CraftingScreen } from "@/ui/screens/crafting/ui/CraftingScreen";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";

/** Запас вида так, как его знает сумка: он существует и принадлежит ей. */
function stockOf(stores: AppStores, nameRu: string): number | undefined {
  return shown(stores).bag.items.find((item) => item.nameRu === nameRu)?.bagCount;
}

function knownList(): ReturnType<typeof within> {
  return within(screen.getByRole("list", { name: "Знание об ингредиентах" }));
}

describe("«Ремесло»", () => {
  it("«Ремесло» показывает раскрытое знание, а не запас", async () => {
    const stores = await createTestStores(
      withIngredientKnowledge(createThorne(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
        { number: 3, nameRu: "Взрыв", rarity: "rare" },
      ]),
    );

    // Три порции того же вида — тем же путём, каким их заводят в «Вещах».
    for (const nameRu of [MOON_HERB, MOON_HERB, MOON_HERB]) {
      await stores.session.getState().execute({ kind: "add_item", nameRu, itemKind: "ingredient" });
    }

    renderOn(stores, <CraftingScreen />);

    const known = knownList();
    expect(known.getByText(MOON_HERB)).toBeDefined();
    expect(known.getByText("Лечение здоровья")).toBeDefined();
    expect(known.getByText("Взрыв")).toBeDefined();
    // Номер говорит, насколько глубоко свойство было скрыто: третье раскрыто через нераскрытое второе.
    expect(known.getByText("3-е")).toBeDefined();
    expect(known.getByText("редкое")).toBeDefined();

    // Запас никуда не делся — он просто отвечает не здесь, и тронуть его отсюда нечем.
    expect(stockOf(stores, MOON_HERB)).toBe(3);
    expect(known.queryByText("3")).toBeNull();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("«Ремесло»: счёт раскрытого назван без знаменателя", async () => {
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
        { number: 2, nameRu: "Временное здоровье", rarity: "uncommon" },
      ]),
    );

    expect(knownList().getByText("раскрыто 2 · следующее не исследовано")).toBeDefined();
    // Сколько у вида свойств всего, приложение не знает: потолок правил фактом вида не является.
    expect(screen.queryByText(/из \d/)).toBeNull();
  });

  it("«Ремесло»: записанный вид без раскрытого остаётся строкой", async () => {
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), CRIMSON_ROOT),
    );

    const known = knownList();
    expect(known.getByText(CRIMSON_ROOT)).toBeDefined();
    // Ноль — состояние: запись завели раньше, чем узнали хоть что-то, и исчезнуть она не вправе.
    expect(known.getByText("раскрыто 0 · следующее не исследовано")).toBeDefined();
  });

  it("«Ремесло»: пустой список объясняет себя словами", async () => {
    await renderWithStores(<CraftingScreen />);

    expect(screen.queryByRole("list", { name: "Знание об ингредиентах" })).toBeNull();
    expect(screen.getByText(/Об ингредиентах пока ничего не записано/)).toBeDefined();
  });
});
