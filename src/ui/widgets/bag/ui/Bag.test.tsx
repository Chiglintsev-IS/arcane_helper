// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { materialOf } from "@/core/application/casting/material";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { Bag } from "./Bag";

/** Карточки, по которым идёт игра: требование вещи называет карточка, а не вещь. */
const spells = loadThorneSpells();

/** Карточка по имени: подделка рядом отвечала бы за себя, а не за содержимое игры. */
function spellOf(id: string) {
  const found = spells.find((spell) => spell.id === id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

afterEach(cleanup);

/** Перечни строит настоящий презентер: подделка рядом проверяла бы себя, а не приложение. */
const { stats } = toChoicesView();

const NOOP = {
  stats,
  onEditMoney: () => {},
  onOpenItem: () => {},
  onAddItem: () => {},
  onAdjustBagCount: () => {},
};

/** Персонаж с добавленными вещами и их запасом в сумке — поверх обычного снаряжения Торна. */
function withStock(entries: { definition: ItemDefinition; bag?: number }[]): CharacterState {
  const state = createThorne();
  return {
    ...state,
    itemDefinitions: [...state.itemDefinitions, ...entries.map((entry) => entry.definition)],
    equipment: {
      ...state.equipment,
      bag: [
        ...state.equipment.bag,
        ...entries
          .filter((entry) => (entry.bag ?? 0) > 0)
          .map((entry) => ({ itemId: entry.definition.id, count: entry.bag ?? 0 })),
      ],
    },
  };
}

const potion: ItemDefinition = {
  id: "healing-potion",
  nameRu: "Зелье лечения",
  kind: "consumable",
  price: { amount: 50, currency: "gold" },
};

describe("«Сумка» в «Вещах»", () => {
  it("держит кошелёк и три счётных раздела (FR-242)", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} />);

    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Расходники" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Ингредиенты" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Другое" })).toBeDefined();

    // Надеваемое показывается отдельно вместе с числом, которое от него зависит.
    expect(screen.queryByRole("heading", { name: "Экипировка" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Защита" })).toBeNull();
    expect(screen.queryByText(/без доспехов/)).toBeNull();
    // Прибавки без вещи — свойство персонажа: их карточка живёт на «Листе», не в сумке.
    expect(screen.queryByRole("heading", { name: "Прибавки без вещи" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Прочие прибавки" })).toBeNull();
  });

  it("покупок в сумке нет: их показывают отдельно (FR-304)", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} />);

    // Сумка отвечает, что в ней есть; чего в ней нет — вопрос лавки, и у него своё место.
    const titles = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(titles).toEqual(["Деньги", "Расходники", "Ингредиенты", "Другое"]);
    expect(screen.queryByRole("list", { name: "Купить" })).toBeNull();
  });

  it("истраченная до нуля вещь ушла из своей категории (FR-302)", () => {
    const ashes = materialOf(spellOf("find-familiar").components);
    if (ashes === undefined) throw new Error("«Поиск фамильяра» материала не требует");

    render(<Bag bag={toBagView(withStock([{ definition: ashes, bag: 0 }]), spells)} {...NOOP} />);

    // Переезд, а не копия: перед вылазкой ноль ищут в покупках, и в своей категории вещи на это
    // время нет вовсе. Категорию называет карточка: сжигаемое ритуалом — расходник.
    expect(screen.queryByRole("list", { name: "Расходники" })?.textContent ?? "").not.toContain(
      ashes.nameRu,
    );
  });

  it("пополненная вещь вернулась в свою категорию (FR-302)", () => {
    const ashes = materialOf(spellOf("find-familiar").components);
    if (ashes === undefined) throw new Error("«Поиск фамильяра» материала не требует");

    render(<Bag bag={toBagView(withStock([{ definition: ashes, bag: 1 }]), spells)} {...NOOP} />);

    expect(
      within(screen.getByRole("list", { name: "Расходники" })).getByText(ashes.nameRu),
    ).toBeDefined();
  });

  it("кошелёк показывает все три монеты стола, включая нули (FR-242)", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} />);
    const purse = screen.getByRole("list", { name: "Кошелёк" });
    expect(within(purse).getAllByRole("listitem")).toHaveLength(3);
    expect(purse.textContent).toContain("зм");
    expect(purse.textContent).toContain("см");
    expect(purse.textContent).toContain("мм");
  });

  it("вещь стоит в разделе своей категории, а не общим списком (FR-238)", () => {
    render(<Bag bag={toBagView(withStock([{ definition: potion, bag: 3 }]), spells)} {...NOOP} />);

    const consumables = screen.getByRole("list", { name: "Расходники" });
    expect(within(consumables).getByText("Зелье лечения")).toBeDefined();
    // Раздел без вещей списка не держит, но строка ввода в нём есть.
    expect(screen.queryByRole("list", { name: "Ингредиенты" })).toBeNull();
    expect(screen.getByLabelText("Новый ингредиент")).toBeDefined();
  });

  it("счётный раздел меняет запас в сумке кнопками строки: минус и плюс (FR-239)", async () => {
    const user = userEvent.setup();
    const onAdjustBagCount = vi.fn();
    render(
      <Bag
        bag={toBagView(withStock([{ definition: potion, bag: 3 }]), spells)}
        {...NOOP}
        onAdjustBagCount={onAdjustBagCount}
      />,
    );

    // Запас стоит между кнопками, которые его двигают.
    const row = within(screen.getByRole("list", { name: "Расходники" })).getByRole("listitem");
    expect(row.textContent).toContain("3");

    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));

    expect(onAdjustBagCount).toHaveBeenNthCalledWith(1, "healing-potion", -1);
    expect(onAdjustBagCount).toHaveBeenNthCalledWith(2, "healing-potion", 1);
  });

  it("ноль — состояние: кончившийся расходник виден нулём, а минус выключен (FR-239)", () => {
    render(<Bag bag={toBagView(withStock([{ definition: potion, bag: 0 }]), spells)} {...NOOP} />);

    const row = within(screen.getByRole("list", { name: "Расходники" })).getByRole("listitem");
    expect(row.textContent).toContain("Зелье лечения");
    expect(row.textContent).toContain("0");
    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }),
    ).toHaveProperty("disabled", true);
  });

  it("быстрый ввод заводит вещь сразу в категорию раздела (FR-241)", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} onAddItem={onAddItem} />);

    await user.type(screen.getByLabelText("Новый расходник"), "Свиток огненного шара{Enter}");
    expect(onAddItem).toHaveBeenCalledWith("consumable", "Свиток огненного шара");

    // Пустая отправка ничего не заводит.
    await user.type(screen.getByLabelText("Новая вещь"), "{Enter}");
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  it("нажатие на вещь открывает её целиком (FR-241)", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(
      <Bag
        bag={toBagView(withStock([{ definition: potion, bag: 3 }]), spells)}
        {...NOOP}
        onOpenItem={onOpenItem}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Правка: Зелье лечения" }));
    expect(onOpenItem).toHaveBeenCalledWith("healing-potion");
  });

  it("деньги правятся своей шторкой, и открывает её строка кошелька", async () => {
    const user = userEvent.setup();
    const onEditMoney = vi.fn();
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} onEditMoney={onEditMoney} />);

    await user.click(screen.getByRole("button", { name: "Правка: Деньги" }));
    expect(onEditMoney).toHaveBeenCalled();
  });
});
