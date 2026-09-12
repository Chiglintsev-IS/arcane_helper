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
import {
  createTestStores,
  renderOn,
  renderWithStores,
  shown,
} from "@/ui/app/testing/stores";
import { AlchemyScreen } from "./AlchemyScreen";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";

function stockOf(stores: AppStores, nameRu: string): number | undefined {
  return shown(stores).bag.items.find((item) => item.nameRu === nameRu)
    ?.bagCount;
}

/** Знание об ингредиентах собирается прогоном с нуля: начальное содержимое здесь только помешало бы. */
function blank(): ReturnType<typeof createThorne> {
  return withoutIngredientKnowledge(createThorne());
}

function knownList(): ReturnType<typeof within> {
  return within(screen.getByRole("list", { name: "Знание об ингредиентах" }));
}

function cardOf(nameRu: string): HTMLElement {
  return knownList().getByRole("button", { name: new RegExp(`^${nameRu}`) });
}

function takeName(nameRu: string): string {
  return `В состав: ${nameRu}`;
}

async function stocked(
  stores: AppStores,
  nameRu: string,
  count: number,
): Promise<void> {
  await stores.session
    .getState()
    .execute({ kind: "set_bag_count", itemId: Items.idFromName(nameRu), count });
}

async function openTab(user: ReturnType<typeof userEvent.setup>, labelRu: string): Promise<void> {
  await user.click(screen.getByRole("tab", { name: labelRu }));
}

describe("«Алхимия»", () => {
  it("«Алхимия» показывает раскрытое знание, а не запас", async () => {
    const stores = await createTestStores(
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 3, nameRu: "Взрыв" },
      ]),
    );
    await stocked(stores, MOON_HERB, 3);

    renderOn(stores, <AlchemyScreen />);

    const known = knownList();
    expect(known.getByText(MOON_HERB)).toBeDefined();
    expect(known.getByText("Лечение здоровья")).toBeDefined();
    expect(known.getByText("Взрыв")).toBeDefined();
    expect(known.getByText("3-е")).toBeDefined();
    expect(known.getByText("в сумке 3")).toBeDefined();

    await userEvent.setup().click(cardOf(MOON_HERB));
    expect(stockOf(stores, MOON_HERB)).toBe(3);
    expect(screen.getByRole("dialog", { name: `Свойства: ${MOON_HERB}` })).toBeDefined();
  });

  it("«Алхимия»: счёта раскрытого на карточке нет", async () => {
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 2, nameRu: "Временное здоровье" },
      ]),
    );

    expect(knownList().getByText("в сумке 0")).toBeDefined();
    expect(screen.queryByText(/раскрыто/)).toBeNull();
  });

  it("«Алхимия»: отметка стола видна в списке и снимается там же, где ставилась", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
      ]),
    );

    expect(knownList().queryByText("Свойств у вида больше нет")).toBeNull();

    await user.click(cardOf(MOON_HERB));
    await user.click(screen.getByRole("switch", { name: "Свойств у вида больше нет" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(await knownList().findByText("Свойств у вида больше нет")).toBeDefined();

    await user.click(cardOf(MOON_HERB));
    await user.click(screen.getByRole("switch", { name: "Свойств у вида больше нет" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(knownList().queryByText("Свойств у вида больше нет")).toBeNull();
  });

  it("«Алхимия»: порции называются, когда порция не штука", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );
    await stocked(stores, MOON_HERB, 63);

    expect(await knownList().findByText("в сумке 63")).toBeDefined();

    await user.click(cardOf(MOON_HERB));
    await user.clear(screen.getByLabelText("Штук в порции"));
    await user.type(screen.getByLabelText("Штук в порции"), "10");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(await knownList().findByText("в сумке 63 · 6 порций")).toBeDefined();
  });

  it("«Алхимия»: вид без запаса в состав не берут, и сумка говорит почему", async () => {
    await renderWithStores(<AlchemyScreen />, withIngredientKnowledge(blank(), MOON_HERB));

    expect(knownList().getByText("В сумке 0, столько не потратить")).toBeDefined();
    expect(screen.queryByRole("button", { name: takeName(MOON_HERB) })).toBeNull();
  });

  it("«Алхимия»: набор назван один на всю алхимию", async () => {
    await renderWithStores(<AlchemyScreen />);

    const workshop = within(screen.getByRole("button", { name: /Мастерская/ }));

    expect(workshop.getByText("Надёжный походный комплект")).toBeDefined();
    expect(workshop.queryByText(/Кузнечное дело/)).toBeNull();
  });

  it("«Алхимия»: пустой список объясняет себя словами", async () => {
    await renderWithStores(<AlchemyScreen />, blank());

    expect(
      screen.queryByRole("list", { name: "Знание об ингредиентах" }),
    ).toBeNull();
    expect(
      screen.getByText(/Об ингредиентах пока ничего не записано/),
    ).toBeDefined();
  });
});

function twoKinds(): ReturnType<typeof createThorne> {
  return [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) =>
      withIngredientKnowledge(character, kind, [
        { number: 1, nameRu: "Лечение здоровья" },
      ]),
    blank(),
  );
}

async function assembled(character = twoKinds()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<AlchemyScreen />, character);
  for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) {
    await stocked(rendered.stores, nameRu, 4);
  }
  for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) {
    await user.click(await screen.findByRole("button", { name: takeName(nameRu) }));
  }
  await openTab(user, "Верстак");
  return { user, ...rendered };
}

describe("«Алхимия»: верстак", () => {
  it("«Алхимия»: отмеченные виды дают совпавшее свойство и разбор сложности", async () => {
    await assembled();

    const bench = within(
      await screen.findByRole("region", { name: "Верстак" }),
    );
    expect(await bench.findByText("Лечение здоровья")).toBeDefined();
    expect(await bench.findByText("10")).toBeDefined();
  });

  it("«Алхимия»: состав виден на верстаке и снимается там же", async () => {
    const { user } = await assembled();

    const taken = within(screen.getByRole("list", { name: "В составе" }));
    expect(taken.getByText(MOON_HERB)).toBeDefined();

    await user.click(
      screen.getByRole("button", { name: `Убрать из состава: ${MOON_HERB}` }),
    );

    expect(screen.queryByRole("list", { name: "В составе" })).toBeDefined();
    expect(screen.queryByText(MOON_HERB)).toBeNull();
  });

  it("«Алхимия»: свойство своим словом считается наравне с прочими", async () => {
    const own = [MOON_HERB, CRIMSON_ROOT].reduce(
      (character, kind) =>
        withIngredientKnowledge(character, kind, [{ number: 1, nameRu: "Отвращение к пиву" }]),
      blank(),
    );
    await assembled(own);

    const bench = within(await screen.findByRole("region", { name: "Верстак" }));
    expect(await bench.findByText("Отвращение к пиву")).toBeDefined();
    expect(bench.getByText("Сложность")).toBeDefined();
    expect(bench.getByText("10")).toBeDefined();
  });

  it("«Алхимия»: цена варианта стоит в самом списке, до выбора", async () => {
    await assembled();

    await screen.findByRole("region", { name: "Верстак" });

    expect(
      within(screen.getByLabelText("Длительность")).getByRole("option", { name: "+12 · 24 часа" }),
    ).toBeDefined();
    expect(
      within(screen.getByLabelText("Сопротивление")).getByRole("option", {
        name: "−2 · Спасбросок с преимуществом",
      }),
    ).toBeDefined();
  });

  it("«Алхимия»: отказ по пределу оснащения называет, чем набрано лишнее", async () => {
    const { user } = await assembled();

    await screen.findByRole("region", { name: "Верстак" });
    await user.selectOptions(screen.getByLabelText("Длительность"), "24 часа");

    expect(await screen.findByText(/выше предела оснащения 20/)).toBeDefined();
    expect(screen.getByText(/Длительность \+12/)).toBeDefined();
  });

  it("«Алхимия»: нехватка запаса названа до изготовления и названа видом", async () => {
    const { user, stores } = await assembled();

    await stocked(stores, MOON_HERB, 1);
    await user.clear(screen.getByLabelText("Рецептурных порций"));
    await user.type(screen.getByLabelText("Рецептурных порций"), "2");

    expect(
      await screen.findByText(`${MOON_HERB}: В сумке 1, столько не потратить`),
    ).toBeDefined();
  });

  it("«Алхимия»: мастерская правится там же, где объясняет предел", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<AlchemyScreen />, twoKinds());

    await user.click(screen.getByRole("button", { name: /Мастерская/ }));
    await user.selectOptions(
      screen.getByLabelText("Набор"),
      "Профессиональный лабораторный модуль",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const workshop = shown(stores).crafting.workshop;
    expect(workshop.apparatusRu).toBe("Профессиональный лабораторный модуль");
  });
});

describe("«Алхимия»: запись знания", () => {
  it("«Алхимия»: вид записывается одной строкой, свойство — номером и словом стола", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<AlchemyScreen />);

    await user.type(
      screen.getByLabelText("Записать вид"),
      `${MOON_HERB}{Enter}`,
    );
    expect(await knownList().findByText(MOON_HERB)).toBeDefined();

    await user.click(cardOf(MOON_HERB));
    await user.type(screen.getByLabelText("Свойство"), "Лечение здоровья");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const known = shown(stores).crafting.ingredients.find(
      (kind) => kind.nameRu === MOON_HERB,
    );
    expect(known?.properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья" },
    ]);
  });

  it("шторка свойств названа тем же делом, что и карточка", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );

    await user.click(cardOf(MOON_HERB));

    const door = `Свойства: ${MOON_HERB}`;
    const sheet = within(screen.getByRole("dialog", { name: door }));
    expect(sheet.getByRole("heading", { name: door })).toBeDefined();
  });

  it("«Алхимия»: цена исследования названа прежде, чем за него взялись", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );

    await user.click(cardOf(MOON_HERB));
    expect(await screen.findByText("5")).toBeDefined();
    expect(
      screen.getByText(
        /10 мин · 1 порция только при провале · без расходников/,
      ),
    ).toBeDefined();
    expect(screen.getByText(/Сырая проба/)).toBeDefined();
  });

  it("«Алхимия»: цена названа сразу для следующего номера, а раскрытых в выборе нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
      ]),
    );

    await user.click(cardOf(MOON_HERB));

    const numbers = within(screen.getByLabelText("Номер"));
    expect(numbers.queryByRole("option", { name: "1-е" })).toBeNull();
    expect(numbers.getByRole("option", { name: "2-е" })).toBeDefined();

    expect(await screen.findByText("12")).toBeDefined();
    expect(
      screen.getByText(
        /1 ч · 1 порция при любом исходе · расходники обычные, 1 зм/,
      ),
    ).toBeDefined();
  });

  it("«Алхимия»: отказ по оснащению называет причину словами владельца", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );

    await user.click(screen.getByRole("button", { name: /Мастерская/ }));
    await user.selectOptions(screen.getByLabelText("Набор"), "");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(cardOf(MOON_HERB));

    expect(await screen.findByText(/без набора/)).toBeDefined();
    expect(screen.queryByText("5")).toBeNull();
  });

  it("«Алхимия»: до третьего свойства походным комплектом не добраться", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 2, nameRu: "Временное здоровье" },
      ]),
    );

    await user.click(cardOf(MOON_HERB));

    expect(await screen.findByText(/стационарной лаборатории/)).toBeDefined();
  });

  it("«Алхимия»: отказ владельца стоит в той шторке, где набирали", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [
        { number: 1, nameRu: "Лечение здоровья" },
      ]),
    );

    await user.click(cardOf(MOON_HERB));
    await user.type(screen.getByLabelText("Свойство"), "Лечение здоровья");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText(/уже раскрыто/)).toBeDefined();
  });
});

describe("«Алхимия»: справочник", () => {
  it("справочник называет пределы оснащения и отмечает нынешний набор", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, blank());

    await openTab(user, "Справочник");

    const kits = within(screen.getByRole("table", { name: /Оснащение/ }));
    expect(kits.getByRole("row", { name: /Импровизированные сосуды/ })).toBeDefined();
    expect(kits.getByRole("row", { name: /Надёжный походный комплектсейчас 20 6/ })).toBeDefined();
  });

  it("справочник называет глубину исследования и последствия аварии", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, blank());

    await openTab(user, "Справочник");

    expect(
      within(screen.getByRole("table", { name: /исследования/ })).getByRole("row", {
        name: /4-естационарный · расходники 24 ч 25 3 \/ 3/,
      }),
    ).toBeDefined();
    expect(
      within(screen.getByRole("table", { name: /Авария/ })).getByRole("row", {
        name: /1–2 Реакция гаснет/,
      }),
    ).toBeDefined();
  });
});
