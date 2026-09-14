// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withIngredientKnowledge,
  withoutIngredientKnowledge,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import { Items } from "@/core/domain/items/items";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { AlchemyScreen } from "./AlchemyScreen";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";
const HEALING = { number: 1, nameRu: "Лечение здоровья" } as const;

/** Знание об ингредиентах собирается прогоном с нуля: начальное содержимое здесь только помешало бы. */
function blank(): ReturnType<typeof createThorne> {
  return withoutIngredientKnowledge(createThorne());
}

function twoKinds(): ReturnType<typeof createThorne> {
  return [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING]),
    blank(),
  );
}

async function stocked(stores: AppStores, nameRu: string, count: number): Promise<void> {
  await stores.session
    .getState()
    .execute({ kind: "set_bag_count", itemId: Items.idFromName(nameRu), count });
}

function press(nameRu: string | RegExp): HTMLElement {
  return screen.getByRole("button", { name: nameRu });
}

async function openSection(
  user: ReturnType<typeof userEvent.setup>,
  titleRu: string,
): Promise<void> {
  await user.click(screen.getByRole("button", { name: new RegExp(titleRu) }));
}

async function openBench(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Верстак" }));
}

describe("«Алхимия»: книга", () => {
  it("книга открывается разделами, и каждый считает свои записи", async () => {
    await renderWithStores(<AlchemyScreen />, twoKinds());

    expect(press(/Ингредиенты/).textContent).toContain("2 вида записано");
    expect(press(/Рецепты/).textContent).toContain("0 записей");
    expect(press(/Правила стола/).textContent).toContain("3 главы");
  });

  it("список видов идёт по буквам, и изученность видна у каждой строки", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING, { number: 2, nameRu: "Взрыв" }]),
    );

    await openSection(user, "Ингредиенты");

    expect(screen.getByRole("heading", { name: "Л" })).toBeDefined();
    expect(within(press(new RegExp(MOON_HERB))).getByLabelText("Раскрыто свойств: 2")).toBeDefined();
  });

  it("страница вида называет слоты свойств и цену очередного раскрытия", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    expect(screen.getByRole("heading", { name: MOON_HERB })).toBeDefined();
    expect(screen.getByText("Лечение здоровья")).toBeDefined();
    expect(screen.getAllByText("не раскрыто")).toHaveLength(3);
    expect(await screen.findByText("Раскрыть 2-е свойство")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("1 час")).toBeDefined();
  });

  it("свойство раскрывают из блока раскрытия, и запас вида назван там же порциями", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );
    await stocked(stores, MOON_HERB, 6);
    await stores.session
      .getState()
      .execute({ kind: "set_portion_size", itemId: Items.idFromName(MOON_HERB), pieces: 2 });

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(await screen.findByRole("button", { name: /Раскрыть 1-е свойство/ }));

    const sheet = within(screen.getByRole("dialog", { name: `Свойства: ${MOON_HERB}` }));
    expect(sheet.getByText(/в сумке 6 · 3 порции/)).toBeDefined();

    await user.click(press("Зельеварение"));
    await user.type(screen.getByRole("textbox", { name: "Свойство" }), "Лечение здоровья");
    await user.click(press("Сохранить"));

    expect(
      shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB)?.properties,
    ).toEqual([{ number: 1, nameRu: "Лечение здоровья", dirRu: "Зельеварение" }]);
  });

  it("поле вида дописывается со слов мастера и перекрывает прежнее", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(press(/НАЙТИ/));
    await user.type(screen.getByLabelText("СЛ поиска"), "9");
    await user.click(press("Записать"));

    const known = shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB);
    expect(known?.findDc).toBe(9);
  });

  it("вид записывается со страницы списка и сразу встаёт в книгу", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<AlchemyScreen />, blank());

    await openSection(user, "Ингредиенты");
    await user.click(press("Записать вид"));
    await user.type(screen.getByLabelText("Название"), MOON_HERB);
    await user.click(press("Записать"));

    expect(shown(stores).crafting.ingredients.map((kind) => kind.nameRu)).toEqual([MOON_HERB]);
  });

  it("правила стола идут тремя главами и отмечают нынешний набор", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, blank());

    await openSection(user, "Правила стола");

    expect(screen.getByRole("heading", { name: "Раскрытие свойств" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Варка зелья" })).toBeDefined();
    expect(
      within(screen.getByRole("table", { name: "Оснащение" })).getByRole("row", {
        name: /Надёжный походный комплектсейчас 20 6/,
      }),
    ).toBeDefined();
  });
});

async function assembled(character = twoKinds()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<AlchemyScreen />, character);
  for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) {
    await stocked(rendered.stores, nameRu, 4);
  }

  await openBench(user);
  for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) {
    await user.click(press(`${nameRu}: +`));
  }
  return { user, ...rendered };
}

describe("«Алхимия»: верстак", () => {
  it("взятые виды дают совпавшее свойство и цену замысла", async () => {
    await assembled();

    expect(await screen.findByText("основной эффект")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("Лунная трава, Багровый корень · ступень обычная")).toBeDefined();
  });

  it("цена варианта формы стоит в самом списке, до выбора", async () => {
    const { user } = await assembled();

    await user.click(press(/Длительность/));

    expect(press("24 часа+12")).toBeDefined();
  });

  it("сверх предела набора верстак предупреждает, но работать не запрещает", async () => {
    const { user, stores } = await assembled();

    await user.click(press(/Длительность/));
    await user.click(press("24 часа+12"));

    expect(await screen.findByText(/выше предела набора \(20\)/)).toBeDefined();

    await user.click(press(/Заложить партию/));

    expect(shown(stores).log.some((entry) => entry.summaryRu.startsWith("Заложено"))).toBe(true);
  });

  it("расход партии называет нужное и то, чего недостаёт", async () => {
    const { user, stores } = await assembled();

    await stocked(stores, MOON_HERB, 1);
    await user.click(press("порций заложено: +"));

    expect(await screen.findByText("нужно 2 порции из 1")).toBeDefined();
    expect(screen.getByText("не хватает 1")).toBeDefined();
  });

  it("набор меняется прямо на верстаке", async () => {
    const { user, stores } = await assembled();

    await user.click(press(/ОСНАЩЕНИЕ/));
    await user.click(press(/Профессиональный лабораторный модуль/));

    expect(shown(stores).crafting.workshop.apparatusRu).toBe(
      "Профессиональный лабораторный модуль",
    );
  });

  it("заложенная партия списывает порции каждого вида одной записью", async () => {
    const { user, stores } = await assembled();

    await user.click(press(/Заложить партию/));

    const bag = shown(stores).bag.items;
    expect(bag.find((item) => item.nameRu === MOON_HERB)?.bagCount).toBe(3);
    expect(bag.find((item) => item.nameRu === CRIMSON_ROOT)?.bagCount).toBe(3);
    expect(
      shown(stores).log.filter((entry) => entry.summaryRu.startsWith("Заложено")),
    ).toHaveLength(1);
  });

  it("записанный рецепт встаёт в книгу и возвращается на верстак", async () => {
    const { user, stores } = await assembled();

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Книга" }));
    await openSection(user, "Рецепты");
    await user.click(press("Записать рецепт"));

    expect(shown(stores).crafting.recipes.map((recipe) => recipe.nameRu)).toEqual([
      "Лечение здоровья",
    ]);
    expect(await screen.findByText(/нужен набор на сложность 10/)).toBeDefined();
  });
});
