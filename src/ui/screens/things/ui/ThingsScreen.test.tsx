// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { knowing } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, shown, testSnapshot } from "@/ui/app/testing/stores";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";

function itemOf(stores: AppStores, id: string): ItemView | undefined {
  return shown(stores).bag.items.find((item) => item.id === id);
}

const STORAGE_KEY = "thingsPart";

afterEach(() => {
  localStorage.clear();
});

describe("«Вещи» (FR-304)", () => {
  it("«Вещи» показывают одну часть из трёх, и переключатель называет какую (FR-304)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />, knowing(createThorne(), "arcane-lock"));

    const parts = within(screen.getByRole("radiogroup", { name: "Что показать" }));
    expect(parts.getAllByRole("radio").map((button) => button.textContent)).toEqual([
      "Экипировка",
      "Сумка",
      "Покупки",
    ]);

    expect(screen.getByRole("heading", { name: "Защита" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Деньги" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Купить" })).toBeNull();

    await user.click(parts.getByRole("radio", { name: "Сумка" }));
    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Защита" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Купить" })).toBeNull();

    await user.click(parts.getByRole("radio", { name: "Покупки" }));
    expect(screen.getByRole("list", { name: "Купить" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Деньги" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Защита" })).toBeNull();
  });

  it("выбранная часть «Вещей» переживает перезапуск (FR-304)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Покупки" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("shopping");

    localStorage.setItem(STORAGE_KEY, "чепуха");
    await renderWithStores(<ThingsScreen />);
    expect(screen.getAllByRole("heading", { name: "Защита" })).toHaveLength(1);
  });

  it("«Экипировка»: надетая вещь двигает КД, снятая — возвращает (FR-234)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialPart="gear" />);

    const before = shown(stores).bag.armorClass.value;

    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ bagCount: 1, wornCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before);

    await user.click(screen.getByRole("button", { name: "Правка: Кольцо защиты" }));
    await user.selectOptions(screen.getByLabelText("Добавить прибавку"), "armorClass");
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    const armorField = screen.getByLabelText("Класс Доспеха");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 1, bagCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before + 1);
    expect(shown(stores).sheet.abilities).toEqual(testSnapshot().sheet.abilities);

    const worn = within(screen.getByRole("list", { name: "На мне" }));
    await user.click(worn.getByRole("button", { name: "Снять один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 0, bagCount: 1 });
    expect(shown(stores).bag.armorClass.value).toBe(before);
  });

  it("«Сумка»: расходник тратится и пополняется со строки, деньги правятся шторкой (FR-242)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialPart="bag" />);

    await user.type(screen.getByLabelText("Новый расходник"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));

    expect(shown(stores).bag.items.find((item) => item.id === "зелье-лечения")?.bagCount).toBe(0);
    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }),
    ).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Правка: Деньги" }));
    const gold = screen.getByLabelText("Золото");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).bag.money.find((coin) => coin.currency === "gold")?.amount).toBe(215);
    expect(shown(stores).log.at(-1)?.summaryRu).toBe("Деньги: зм 0 → 215");
  });

  it("«Сумка»: вещь без прибавок меняет категорию, а не получает отказ про прибавки (FR-235)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialPart="bag" />);

    await user.type(screen.getByLabelText("Новый ингредиент"), "Пыль{Enter}");
    await user.click(screen.getByRole("button", { name: "Правка: Пыль" }));
    await user.click(screen.getByRole("radio", { name: "Другое" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).bag.items.find((item) => item.id === "пыль")?.kind).toBe("other");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("«Покупки»: купленное уходит из лавки и ложится в сумку (FR-302)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <ThingsScreen initialPart="shopping" />,
      knowing(createThorne(), "arcane-lock"),
    );

    await user.click(screen.getByRole("button", { name: /Добавить один в сумку: золотая пыль/ }));

    expect(screen.queryByRole("button", { name: /Добавить один в сумку: золотая пыль/ })).toBeNull();
    const bought = shown(stores).bag.items.find((item) => item.nameRu.startsWith("золотая пыль"));
    expect(bought?.bagCount).toBe(1);

    await user.click(screen.getByRole("radio", { name: "Сумка" }));
    expect(screen.getByRole("button", { name: /^Правка: золотая пыль/ })).toBeDefined();
  });
});
