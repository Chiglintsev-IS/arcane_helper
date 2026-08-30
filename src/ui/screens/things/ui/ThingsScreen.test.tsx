// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, shown, testSnapshot } from "@/ui/app/testing/stores";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";

function itemOf(stores: AppStores, id: string): ItemView | undefined {
  return shown(stores).bag.items.find((item) => item.id === id);
}

const PART_KEY = "thingsPart";

const BAG_FILTER_KEY = "thingsBagFilter";

const BASE_FILTER_KEY = "thingsBaseFilter";

afterEach(() => {
  localStorage.clear();
});

describe("«Вещи»", () => {
  it("рюкзак и база вещей — две части с разными фильтрами", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />);

    const parts = within(screen.getByRole("radiogroup", { name: "Что показать" }));
    expect(parts.getAllByRole("radio").map((button) => button.textContent)).toEqual([
      "Рюкзак",
      "Все вещи",
    ]);

    expect(screen.getByRole("radiogroup", { name: "Что в рюкзаке" })).toBeDefined();
    expect(screen.queryByLabelText("Поиск")).toBeNull();

    await user.click(within(screen.getByRole("radiogroup", { name: "Что в рюкзаке" })).getByRole(
      "radio",
      { name: "Надето" },
    ));
    expect(screen.getByRole("heading", { name: "Защита" })).toBeDefined();

    await user.click(parts.getByRole("radio", { name: "Все вещи" }));
    expect(screen.queryByRole("radiogroup", { name: "Что в рюкзаке" })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Какие вещи" })).toBeDefined();
    expect(screen.getByLabelText("Поиск")).toBeDefined();
  });

  it("выбранное переживает перезапуск, а чепуха в памяти — нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Расходники" }));
    await user.click(screen.getByRole("radio", { name: "Все вещи" }));
    await user.click(screen.getByRole("radio", { name: "Покупки" }));

    expect(localStorage.getItem(PART_KEY)).toBe("base");
    expect(localStorage.getItem(BAG_FILTER_KEY)).toBe("consumable");
    expect(localStorage.getItem(BASE_FILTER_KEY)).toBe("wanted");

    localStorage.setItem(PART_KEY, "чепуха");
    localStorage.setItem(BAG_FILTER_KEY, "чепуха");
    const { container } = await renderWithStores(<ThingsScreen />);
    expect(within(container).getByRole("radio", { name: "Рюкзак" })).toHaveProperty(
      "ariaChecked",
      "true",
    );
    expect(within(container).getByRole("radio", { name: "Всё" })).toHaveProperty(
      "ariaChecked",
      "true",
    );
  });

  it("надетая вещь двигает КД, снятая — возвращает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />);

    const before = shown(stores).bag.armorClass.value;

    await user.click(screen.getByRole("radio", { name: "Экипировка" }));
    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ bagCount: 1, wornCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before);

    await user.click(screen.getByRole("button", { name: "Правка: Кольцо защиты" }));
    await user.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Класс Доспеха/,
      }),
    );
    const armorField = screen.getByLabelText("Класс Доспеха");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 1, bagCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before + 1);
    expect(shown(stores).sheet.abilities).toEqual(testSnapshot().sheet.abilities);

    await user.click(screen.getByRole("button", { name: "Снять один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 0, bagCount: 1 });
    expect(shown(stores).bag.armorClass.value).toBe(before);
  });

  it("прибавка «при себе» считается из сумки, не требуя надеть", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />);

    const before = shown(stores).resources.initiative;

    await user.type(screen.getByLabelText("Новая вещь"), "Камень удачи{Enter}");
    await user.click(screen.getByRole("button", { name: "Правка: Камень удачи" }));
    await user.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Инициатива/,
      }),
    );
    const field = screen.getByLabelText("Инициатива");
    await user.clear(field);
    await user.type(field, "1");
    await user.click(screen.getByRole("radio", { name: "при себе" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(itemOf(stores, "камень-удачи")).toMatchObject({ wornCount: 0, worksCarried: true });
    expect(shown(stores).resources.initiative).toBe(before + 1);
  });

  it("кончившийся расходник уходит из рюкзака, оставаясь среди всех вещей", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Расходники" }));
    await user.type(screen.getByLabelText("Новый расходник"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));

    expect(itemOf(stores, "зелье-лечения")?.bagCount).toBe(0);
    expect(screen.queryByRole("button", { name: "Правка: Зелье лечения" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Все вещи" }));
    expect(screen.getByRole("button", { name: "Правка: Зелье лечения" })).toBeDefined();
    expect(itemOf(stores, "зелье-лечения")?.bagCount).toBe(0);
  });

  it("деньги правятся своей шторкой", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />);

    await user.click(screen.getByRole("button", { name: "Правка: Деньги" }));
    const gold = screen.getByLabelText("Золото");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).bag.money.find((coin) => coin.currency === "gold")?.amount).toBe(215);
    expect(shown(stores).log.at(-1)?.summaryRu).toBe("Деньги: зм 0 → 215");
  });

  it("признаки вещи правятся в её шторке, и вещь остаётся собой без единого признака", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Ингредиенты" }));
    await user.type(screen.getByLabelText("Новый ингредиент"), "Пыль{Enter}");
    expect(itemOf(stores, "пыль")?.kinds).toEqual(["ingredient"]);

    await user.click(screen.getByRole("button", { name: "Правка: Пыль" }));
    await user.click(screen.getByRole("button", { name: "Ингредиент" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(itemOf(stores, "пыль")?.kinds).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("встреченную вещь записывают без запаса, покупку — с отметкой", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialPart="base" />);

    await user.type(screen.getByLabelText("Просто запомнить"), "Зелье невидимости{Enter}");

    expect(itemOf(stores, "зелье-невидимости")).toMatchObject({ bagCount: 0, wanted: false });
    expect(shown(stores).log.at(-1)?.summaryRu).toBe("Записано: Зелье невидимости");
  });

  it("покупки — список желаний: заведённое без запаса и отметка у уже лежащего", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialPart="base" />);

    await user.click(screen.getByRole("radio", { name: "Покупки" }));
    expect(screen.getByText("Купить пока нечего.")).toBeDefined();

    await user.type(screen.getByLabelText("Что купить"), "Верёвка{Enter}");

    expect(itemOf(stores, "верёвка")).toMatchObject({ bagCount: 0, wanted: true, kinds: [] });
    expect(screen.getByRole("button", { name: "Правка: Верёвка" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Верёвка" }));
    expect(itemOf(stores, "верёвка")).toMatchObject({ bagCount: 1, wanted: true });

    await user.click(screen.getByRole("button", { name: "Правка: Верёвка" }));
    await user.click(screen.getByRole("button", { name: "Хочу купить" }));
    expect(itemOf(stores, "верёвка")?.wanted).toBe(false);
  });
});
