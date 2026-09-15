// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withIngredientKnowledge,
  withoutIngredientKnowledge,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import { Items } from "@/core/domain/items/items";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { AlchemyScreen } from "./AlchemyScreen";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";
const HEALING = { number: 1, nameRu: "Лечение здоровья" } as const;
const BLAST = { number: 2, nameRu: "Взрыв" } as const;

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

/** Два вида с двумя общими свойствами: в составе есть и основное, и попутное — то, что гасят. */
function twoKindsTwoProperties(): ReturnType<typeof createThorne> {
  return [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING, BLAST]),
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
    expect(press(/Эффекты/).textContent).toContain("225 названий");
  });

  it("список видов идёт по буквам, и изученность видна у каждой строки", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING, { number: 2, nameRu: "Взрыв" }]),
    );

    await openSection(user, "Ингредиенты");

    expect(screen.getByRole("heading", { name: "Л" })).toBeDefined();
    /* Знаки изученности говорят и словами: цветом одним смысл не передаётся. */
    expect(
      within(press(new RegExp(MOON_HERB))).getByLabelText(/Раскрыто свойств: 2 — /),
    ).toBeDefined();
  });

  it("страница вида называет слоты свойств и цену очередного раскрытия", async () => {
    const user = userEvent.setup();
    await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    expect(press(/^Название/).textContent).toContain(MOON_HERB);
    expect(screen.getByText("Лечение здоровья")).toBeDefined();
    expect(screen.getAllByText("не раскрыто")).toHaveLength(3);
    expect(await screen.findByText("Раскрыть 2-е свойство")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("1 ч")).toBeDefined();
  });

  it("раскрытие — своя страница: она называет цену работы по справочнику", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, withIngredientKnowledge(blank(), MOON_HERB));

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(await screen.findByRole("button", { name: /Раскрыть 1-е свойство/ }));

    expect(screen.getByRole("heading", { name: "Раскрыть 1-е свойство" })).toBeDefined();
    expect(screen.getByText("Чего это стоит")).toBeDefined();
    expect(screen.getByText("профильные походные инструменты")).toBeDefined();
    /* Возврат ведёт к странице вида, а не к списку: работу открыли из неё. */
    await user.click(press(MOON_HERB));
    expect(press(/^Название/).textContent).toContain(MOON_HERB);
  });

  it("свойство записывают словами мастера вместе с направлением", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(await screen.findByRole("button", { name: /Раскрыть 1-е свойство/ }));

    await user.click(press("Зельеварение"));
    await user.click(press("Редкое"));
    await user.type(screen.getByRole("textbox", { name: "Свойство" }), "Лечение здоровья");
    await user.click(press("Записать"));

    expect(
      shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB)?.properties,
    ).toEqual([
      { number: 1, nameRu: "Лечение здоровья", dirRu: "Зельеварение", rarityRu: "Редкое" },
    ]);
  });

  it("раскрытое правят нажатием по нему: имя и редкость уточняют теми же полями", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(press(`Правка: ${HEALING.nameRu}`));

    const named = screen.getByRole("textbox", { name: "Свойство" });
    expect(named).toHaveProperty("value", HEALING.nameRu);

    await user.clear(named);
    await user.type(named, "Лечение ран");
    await user.click(press("Редкое"));
    await user.click(press("Записать"));

    const properties = shown(stores).crafting.ingredients[0]?.properties;
    expect(properties).toEqual([
      { number: 1, nameRu: "Лечение ран", dirRu: null, rarityRu: "Редкое" },
    ]);
    expect(shown(stores).log.at(-1)?.summaryRu).toBe(
      `Переписано раскрытое: ${MOON_HERB} — Лечение ран`,
    );
  });

  it("раскрытое убирают с той же страницы", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));
    await user.click(await screen.findByRole("button", { name: /Раскрыть 2-е свойство/ }));
    await user.click(press(`Убрать: ${HEALING.nameRu}`));
    await user.click(press("Да, убрать"));

    expect(
      shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB)?.properties,
    ).toEqual([]);
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

  it("заметки вида правятся тут же и той же формой, что и у вещи", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    await user.click(press("Записать заметку"));
    await user.type(screen.getByLabelText("Заметка"), "Рядом с болотами берут за 2–3 золотых");
    await user.click(press(BUTTON_LABELS.write));

    const notesOf = () =>
      shown(stores).crafting.ingredients.find((kind) => kind.nameRu === MOON_HERB)?.notes ?? [];
    expect(notesOf().map((note) => note.textRu)).toEqual([
      "Рядом с болотами берут за 2–3 золотых",
    ]);

    await user.click(press("Правка: Рядом с болотами берут за 2–3 золотых"));
    await user.click(press(/^Убрать:/));
    await user.click(press("Да, убрать"));
    expect(notesOf()).toHaveLength(0);
  });

  it("имя и цену вида правят в книге — теми же полями, что в карточке вещи", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    await user.click(press(/^Название/));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), `${MOON_HERB}ка{Enter}`);

    await user.click(press(/^Цена за одну штуку/));
    await user.clear(screen.getByLabelText("зм"));
    await user.type(screen.getByLabelText("зм"), "1");
    await user.clear(screen.getByLabelText("мм"));
    await user.type(screen.getByLabelText("мм"), "3");
    await user.click(press(BUTTON_LABELS.write));

    const kind = shown(stores).crafting.ingredients[0];
    expect(kind?.nameRu).toBe(`${MOON_HERB}ка`);
    /* Мелкая монета не теряется от правки в книге: цена у вещи одна, и правят её целиком. */
    expect(kind?.price).toEqual([
      { currency: "gold", amount: 1 },
      { currency: "silver", amount: 0 },
      { currency: "copper", amount: 3 },
    ]);
    expect(shown(stores).log.some((record) => record.summaryRu.startsWith("Переименовано"))).toBe(
      true,
    );
  });

  it("запись убирают со страницы вида, и не раньше, чем ответят на вопрос", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    /* Нажатие само по себе ничего не стирает: случайно задетая кнопка — не решение игрока. */
    await user.click(press(`Убрать запись из алхимии: ${MOON_HERB}`));
    expect(shown(stores).crafting.ingredients).toHaveLength(1);

    await user.click(press(BUTTON_LABELS.dismiss));
    expect(shown(stores).crafting.ingredients).toHaveLength(1);

    await user.click(press(`Убрать запись из алхимии: ${MOON_HERB}`));
    await user.click(press("Да, убрать"));

    expect(shown(stores).crafting.ingredients).toEqual([]);
    expect(shown(stores).bag.items.some((item) => item.nameRu === MOON_HERB)).toBe(true);
    expect(shown(stores).log.at(-1)?.summaryRu).toBe(`Убрана запись из алхимии: ${MOON_HERB}`);
    expect(screen.getByRole("button", { name: "Записать вид" })).toBeDefined();
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

  it("вид открывают с верстака и возвращаются на верстак, не собирая замысел заново", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<AlchemyScreen />, twoKinds());
    await stocked(stores, MOON_HERB, 4);

    await openBench(user);
    await user.click(press(`Открыть вид: ${MOON_HERB}`));

    expect(press(/^Название/).textContent).toContain(MOON_HERB);

    /* Наверху «назад: Верстак», внизу вкладка режима — возврат берут наверху, как и пришли. */
    await user.click(screen.getAllByRole("button", { name: "Верстак" })[0]!);
    expect(screen.getByText("ВИДЫ В СОСТАВ")).toBeDefined();
  });

  it("придя за видом с чужого экрана, возврат ведёт на него, а не в список видов", async () => {
    const user = userEvent.setup();
    const leaving = vi.fn();
    await renderWithStores(
      <AlchemyScreen
        initialKindId={Items.idFromName(MOON_HERB)}
        whenceNameRu="Рюкзак"
        onLeave={leaving}
      />,
      withIngredientKnowledge(blank(), MOON_HERB, [HEALING]),
    );

    await user.click(press("Рюкзак"));
    expect(leaving).toHaveBeenCalled();
  });

  it("пролистнув к соседнему виду, возврат ведёт уже в список: пришедшая карточка не о нём", async () => {
    const user = userEvent.setup();
    const leaving = vi.fn();
    await renderWithStores(
      <AlchemyScreen
        initialKindId={Items.idFromName(MOON_HERB)}
        whenceNameRu="Рюкзак"
        onLeave={leaving}
      />,
      twoKinds(),
    );

    await user.click(press(`Предыдущий вид: ${CRIMSON_ROOT}`));

    expect(screen.queryByRole("button", { name: "Рюкзак" })).toBeNull();
    await user.click(press("Ингредиенты"));
    expect(leaving).not.toHaveBeenCalled();
    expect(press(/Записать вид/)).toBeDefined();
  });

  it("раскрытая книга поднимает к разделам нажатием по своей закладке", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, withIngredientKnowledge(blank(), MOON_HERB, [HEALING]));

    await openSection(user, "Ингредиенты");
    await user.click(press(new RegExp(MOON_HERB)));

    /* Со страницы вида к правилам и рецептам пути назад нет — его даёт закладка уже раскрытой книги. */
    await user.click(press(/^Книга/));

    expect(press(/Правила стола/)).toBeDefined();
    expect(press(/Рецепты/)).toBeDefined();
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

  it("сверх предела набора верстак предупреждает, но замысел считать не перестаёт", async () => {
    const { user } = await assembled();

    await user.click(press(/Длительность/));
    await user.click(press("24 часа+12"));

    expect(await screen.findByText(/выше предела набора \(20\)/)).toBeDefined();
    expect(screen.getByText(/Проверка против 22/)).toBeDefined();
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

  it("верстак называет бросок и ничего не тратит: исход за столом, а не за приложением", async () => {
    const { stores } = await assembled();

    expect(await screen.findByText(/Проверка против 10/)).toBeDefined();
    expect(screen.getByText(/Зельеварение \+ Инт/)).toBeDefined();

    const bag = shown(stores).bag.items;
    expect(bag.find((item) => item.nameRu === MOON_HERB)?.bagCount).toBe(4);
    expect(bag.find((item) => item.nameRu === CRIMSON_ROOT)?.bagCount).toBe(4);
    expect(shown(stores).log.some((entry) => entry.kind === "batch_crafted")).toBe(false);
  });

  it("попутное гасят и возвращают тем же нажатием, а основное подавить не предлагают", async () => {
    const { user } = await assembled(twoKindsTwoProperties());

    const cardOf = (nameRu: string) => () =>
      screen.getAllByRole("listitem").find((one) => one.textContent?.includes(nameRu))!;
    const healing = cardOf("Лечение здоровья");
    const blast = cardOf("Взрыв");

    /* Основное — то, ради чего варят: гасить его значит спорить с собственным замыслом. */
    expect(within(healing()).getByText("основной эффект")).toBeDefined();
    expect(within(healing()).queryByRole("button", { name: "Подавить" })).toBeNull();

    await user.click(within(blast()).getByRole("button", { name: "Подавить" }));
    expect(within(blast()).getByText("подавлено")).toBeDefined();

    await user.click(within(blast()).getByRole("button", { name: "Вернуть в состав" }));
    expect(within(blast()).getByText("войдёт в состав")).toBeDefined();
  });

  it("замысел, которого ремесло не приняло, называет причину словами", async () => {
    const { user } = await assembled(twoKindsTwoProperties());

    /* Один вид совпадения не даёт — и верстак говорит об этом, а не гасит число молча. */
    await user.click(press(`${CRIMSON_ROOT}: ✓`));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Состав собирается из двух разных видов ингредиентов, пока стол не утвердил виду одиночную реакцию",
    );

    await user.click(press(`${CRIMSON_ROOT}: +`));
    expect(screen.queryByRole("alert")).toBeNull();
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

  it("перечень эффектов читается направлениями и ничего не подставляет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<AlchemyScreen />, blank());

    await openSection(user, "Эффекты");

    expect(screen.getByRole("heading", { name: "Зельеварение" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Синтез ядов" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Трансмутация" })).toBeDefined();
    expect(screen.getByText("Хаотическая мутация материи")).toBeDefined();
  });

  it("свойство одного источника берут основным, и работа идёт с предупреждением", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <AlchemyScreen />,
      [
        { nameRu: MOON_HERB, propertyRu: "Лечение здоровья" },
        { nameRu: CRIMSON_ROOT, propertyRu: "Взрыв" },
      ].reduce(
        (character, one) =>
          withIngredientKnowledge(character, one.nameRu, [{ number: 1, nameRu: one.propertyRu }]),
        blank(),
      ),
    );
    for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) await stocked(stores, nameRu, 4);

    await openBench(user);
    for (const nameRu of [MOON_HERB, CRIMSON_ROOT]) await user.click(press(`${nameRu}: +`));

    /* Справочник такого совпадения не даёт — но гасить кнопку за мастера приложение не вправе. */
    expect(await screen.findByText(/Совпавших свойств нет/)).toBeDefined();
    const offered = screen
      .getAllByRole("button", { name: "Сделать основным" })
      .find((button) => button.closest("li")?.textContent?.includes("Лечение здоровья"));
    await user.click(offered!);

    expect(await screen.findByText(/раскрыто только у одного вида/)).toBeDefined();

    /* Подавленное возвращают в состав и там, где справочник совпадения не даёт: иначе роль без выхода. */
    const explosion = screen
      .getAllByRole("listitem")
      .find((one) => one.textContent?.includes("Взрыв"))!;
    expect(within(explosion).queryByRole("button", { name: "Подавить" })).toBeNull();
    expect(within(explosion).getByText("в состав не войдёт, пока не станет основным")).toBeDefined();

    /* Названное основным свойство одного источника тем же нажатием и выводят из состава. */
    const healing = screen
      .getAllByRole("listitem")
      .find((one) => one.textContent?.includes("Лечение здоровья"))!;
    await user.click(within(healing).getByRole("button", { name: "Не основное" }));

    expect(screen.queryByText(/раскрыто только у одного вида/)).toBeNull();
    expect(within(healing).getByText("в состав не войдёт, пока не станет основным")).toBeDefined();
  });
});
