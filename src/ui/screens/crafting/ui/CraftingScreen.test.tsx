// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { createTestStores, renderOn, renderWithStores, shown } from "@/ui/app/testing/stores";
import { CraftingScreen } from "@/ui/screens/crafting/ui/CraftingScreen";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";

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

    for (const nameRu of [MOON_HERB, MOON_HERB, MOON_HERB]) {
      await stores.session.getState().execute({ kind: "add_item", nameRu, itemKinds: ["ingredient"] });
    }

    renderOn(stores, <CraftingScreen />);

    const known = knownList();
    expect(known.getByText(MOON_HERB)).toBeDefined();
    expect(known.getByText("Лечение здоровья")).toBeDefined();
    expect(known.getByText("Взрыв")).toBeDefined();
    expect(known.getByText("3-е")).toBeDefined();
    expect(known.getByText("редкое")).toBeDefined();

    expect(stockOf(stores, MOON_HERB)).toBe(3);
    expect(known.queryByText("3")).toBeNull();
    await userEvent.setup().click(known.getByRole("button", { name: new RegExp(`^${MOON_HERB}`) }));
    expect(stockOf(stores, MOON_HERB)).toBe(3);
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
    expect(screen.queryByText(/из \d/)).toBeNull();
  });

  it("с отметкой счёт раскрытого называет знаменатель", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
        { number: 2, nameRu: "Временное здоровье", rarity: "uncommon" },
      ]),
    );

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    await user.click(screen.getByRole("switch", { name: "Свойств у вида больше нет" }));

    expect(await knownList().findByText("раскрыто 2 из 2")).toBeDefined();

    await user.click(screen.getByRole("switch", { name: "Свойств у вида больше нет" }));
    expect(await knownList().findByText("раскрыто 2 · следующее не исследовано")).toBeDefined();
  });

  it("«Ремесло»: записанный вид без раскрытого остаётся строкой", async () => {
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), CRIMSON_ROOT),
    );

    const known = knownList();
    expect(known.getByText(CRIMSON_ROOT)).toBeDefined();
    expect(known.getByText("раскрыто 0 · следующее не исследовано")).toBeDefined();
  });

  it("«Ремесло»: пустой список объясняет себя словами", async () => {
    await renderWithStores(<CraftingScreen />);

    expect(screen.queryByRole("list", { name: "Знание об ингредиентах" })).toBeNull();
    expect(screen.getByText(/Об ингредиентах пока ничего не записано/)).toBeDefined();
  });
});

function twoKinds(): ReturnType<typeof createThorne> {
  return [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) =>
      withIngredientKnowledge(character, kind, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
      ]),
    createThorne(),
  );
}

async function assembled(character = twoKinds()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<CraftingScreen />, character);
  const known = knownList();
  await user.click(known.getByRole("button", { name: new RegExp(`^${MOON_HERB}`) }));
  await user.click(known.getByRole("button", { name: new RegExp(`^${CRIMSON_ROOT}`) }));
  return { user, ...rendered };
}

describe("«Ремесло»: верстак", () => {
  it("«Ремесло»: отмеченные виды дают совпавшее свойство и разбор сложности", async () => {
    await assembled();

    const bench = within(await screen.findByRole("region", { name: "Верстак" }));
    expect(await bench.findByText("Лечение здоровья")).toBeDefined();
    expect(await bench.findByText("10")).toBeDefined();
  });

  it("«Ремесло»: отказ по пределу оснащения называет, чем набрано лишнее", async () => {
    const { user } = await assembled();

    await screen.findByRole("region", { name: "Верстак" });
    await user.selectOptions(screen.getByLabelText("Длительность"), "24 часа");

    expect(await screen.findByText(/выше предела оснащения 20/)).toBeDefined();
    expect(screen.getByText(/Длительность \+12/)).toBeDefined();
  });

  it("«Ремесло»: гибрид с ядами показывает свой бонус и виноватое направление до броска", async () => {
    const poisonous = [MOON_HERB, CRIMSON_ROOT].reduce(
      (character, kind) =>
        withIngredientKnowledge(character, kind, [
          { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
          { number: 2, nameRu: "Ядовитый урон", rarity: "rare" },
        ]),
      createThorne(),
    );
    const { user } = await assembled(poisonous);

    const bench = within(await screen.findByRole("region", { name: "Верстак" }));
    expect(await bench.findByText(/выше предела оснащения 20/)).toBeDefined();
    await user.click((await bench.findAllByRole("button", { name: "Основной эффект" }))[0]!);

    expect(await screen.findByText("d20 + 4")).toBeDefined();
    expect(screen.getByText(/синтез ядов/)).toBeDefined();
  });

  it("«Ремесло»: мастерская правится там же, где объясняет предел", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CraftingScreen />, twoKinds());

    await user.click(screen.getByRole("button", { name: /Мастерская/ }));
    await user.selectOptions(
      screen.getByLabelText("синтез ядов"),
      "Профессиональный лабораторный модуль",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const workshop = shown(stores).crafting.workshop;
    expect(workshop.apparatus.map((kit) => kit.direction)).toContain("poisons");
  });
});

describe("«Ремесло»: запись знания", () => {
  it("«Ремесло»: вид записывается одной строкой, свойство раскрывается номером и редкостью", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CraftingScreen />);

    await user.type(screen.getByLabelText("Записать вид"), `${MOON_HERB}{Enter}`);
    expect(await knownList().findByText(MOON_HERB)).toBeDefined();

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    await user.selectOptions(screen.getByLabelText("Свойство"), "Лечение здоровья");
    await user.selectOptions(screen.getByLabelText("Редкость"), "uncommon");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const known = shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB);
    expect(known?.properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья", rarity: "uncommon" },
    ]);
  });

  it("шторка раскрытия названа тем же делом, что и дверь", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CraftingScreen />, withIngredientKnowledge(createThorne(), MOON_HERB));

    const door = `Раскрыть свойство: ${MOON_HERB}`;
    await user.click(screen.getByRole("button", { name: door }));

    const sheet = within(screen.getByRole("dialog", { name: door }));
    expect(sheet.getByRole("heading", { name: MOON_HERB })).toBeDefined();
  });

  it("«Ремесло»: цена исследования названа прежде, чем за него взялись", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CraftingScreen />, withIngredientKnowledge(createThorne(), MOON_HERB));

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));

    expect(await screen.findByText("5")).toBeDefined();
    expect(screen.getByText(/10 мин · 1 порция только при провале · без расходников/)).toBeDefined();
    expect(screen.getByText(/Сырая проба/)).toBeDefined();
  });

  it("«Ремесло»: цена исследования растёт с редкостью и глубиной", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
      ]),
    );

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    await user.selectOptions(screen.getByLabelText("Номер"), "2");
    await user.selectOptions(screen.getByLabelText("Редкость"), "rare");

    expect(await screen.findByText("14")).toBeDefined();
    expect(
      screen.getByText(/1 ч · 1 порция при любом исходе · расходники обычные, 1 зм/),
    ).toBeDefined();
  });

  it("«Ремесло»: отказ по оснащению называет причину словами владельца", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CraftingScreen />, withIngredientKnowledge(createThorne(), MOON_HERB));

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    await user.selectOptions(screen.getByLabelText("Направление работы"), "poisons");

    expect(await screen.findByText(/без профильного оснащения не бывает/)).toBeDefined();
    expect(screen.queryByText("5")).toBeNull();
  });

  it("«Ремесло»: до третьего свойства походным комплектом не добраться", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <CraftingScreen />,
      withIngredientKnowledge(createThorne(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
        { number: 2, nameRu: "Временное здоровье", rarity: "uncommon" },
      ]),
    );

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    expect(await screen.findByText(/свойство под номером 3/)).toBeDefined();

    await user.selectOptions(screen.getByLabelText("Номер"), "3");
    expect(await screen.findByText(/стационарной лаборатории/)).toBeDefined();
  });

  it("«Ремесло»: отказ владельца стоит в той шторке, где набирали", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CraftingScreen />, twoKinds());

    await user.click(screen.getByRole("button", { name: `Раскрыть свойство: ${MOON_HERB}` }));
    await user.selectOptions(screen.getByLabelText("Свойство"), "Пробуждение");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText(/номером 1 уже раскрыто/)).toBeDefined();
  });
});
