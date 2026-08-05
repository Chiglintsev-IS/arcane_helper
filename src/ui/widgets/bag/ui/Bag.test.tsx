// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { Bag, itemMeta } from "./Bag";

afterEach(cleanup);

const NOOP = {
  onEditMoney: () => {},
  onOpenItem: () => {},
  onAddItem: () => {},
  onAdjustBagCount: () => {},
  onAdjustWornCount: () => {},
  onEditArmor: () => {},
};

/** Персонаж с добавленными вещами и их запасом в сумке/надетом — поверх обычного снаряжения Торна. */
function withStock(entries: { definition: ItemDefinition; bag?: number; worn?: number }[]): CharacterState {
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
      worn: [
        ...state.equipment.worn,
        ...entries
          .filter((entry) => (entry.worn ?? 0) > 0)
          .map((entry) => ({ itemId: entry.definition.id, count: entry.worn ?? 0 })),
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

describe("экран «Сумка»", () => {
  it("держит деньги, четыре раздела категорий и доспех (FR-242)", () => {
    render(<Bag character={createThorne()} {...NOOP} />);

    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Экипировка" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Расходники" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Ингредиенты" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Другое" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Доспех" })).toBeDefined();
    // Прибавки без вещи — свойство персонажа: их карточка живёт на «Листе», не в сумке.
    expect(screen.queryByRole("heading", { name: "Прибавки без вещи" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Прочие прибавки" })).toBeNull();
  });

  it("кошелёк показывает все три монеты стола, включая нули (FR-242)", () => {
    render(<Bag character={createThorne()} {...NOOP} />);
    const purse = screen.getByRole("list", { name: "Кошелёк" });
    expect(within(purse).getAllByRole("listitem")).toHaveLength(3);
    expect(purse.textContent).toContain("зм");
    expect(purse.textContent).toContain("см");
    expect(purse.textContent).toContain("мм");
  });

  it("вещь стоит в разделе своей категории, а не общим списком (FR-238)", () => {
    render(<Bag character={withStock([{ definition: potion, bag: 3 }])} {...NOOP} />);

    const consumables = screen.getByRole("list", { name: "Расходники" });
    expect(within(consumables).getByText("Зелье лечения ×3")).toBeDefined();
    // Раздел без вещей списка не держит, но строка ввода в нём есть.
    expect(screen.queryByRole("list", { name: "Ингредиенты" })).toBeNull();
    expect(screen.getByLabelText("Новый ингредиент")).toBeDefined();
  });

  it("счётный раздел меняет запас в сумке кнопками строки: минус и плюс (FR-239)", async () => {
    const user = userEvent.setup();
    const onAdjustBagCount = vi.fn();
    render(
      <Bag
        character={withStock([{ definition: potion, bag: 3 }])}
        {...NOOP}
        onAdjustBagCount={onAdjustBagCount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));

    expect(onAdjustBagCount).toHaveBeenNthCalledWith(1, "healing-potion", -1);
    expect(onAdjustBagCount).toHaveBeenNthCalledWith(2, "healing-potion", 1);
  });

  it("ноль — состояние: кончившийся расходник виден нулём, а минус выключен (FR-239)", () => {
    render(<Bag character={withStock([{ definition: potion, bag: 0 }])} {...NOOP} />);

    expect(screen.getByText("Зелье лечения ×0")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }),
    ).toHaveProperty("disabled", true);
  });

  it("экипировка снимается и надевается кнопками строки, счёт в сумке у неё есть тоже (FR-238)", async () => {
    const user = userEvent.setup();
    const onAdjustWornCount = vi.fn();
    render(<Bag character={createThorne()} {...NOOP} onAdjustWornCount={onAdjustWornCount} />);

    await user.click(screen.getByRole("button", { name: "Снять один: Плащ защиты" }));
    expect(onAdjustWornCount).toHaveBeenCalledWith("cloak-of-protection", -1);
    // Плащ надет и не лежит в сумке — надеть больше нечего, кнопка выключена.
    expect(screen.getByRole("button", { name: "Надеть один: Плащ защиты" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("быстрый ввод заводит вещь сразу в категорию раздела (FR-241)", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(<Bag character={createThorne()} {...NOOP} onAddItem={onAddItem} />);

    await user.type(screen.getByLabelText("Новый расходник"), "Свиток огненного шара{Enter}");
    expect(onAddItem).toHaveBeenCalledWith("consumable", "Свиток огненного шара");

    // Пустая отправка ничего не заводит.
    await user.type(screen.getByLabelText("Новая вещь"), "{Enter}");
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  it("нажатие на вещь открывает её целиком (FR-241)", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<Bag character={withStock([{ definition: potion, bag: 3 }])} {...NOOP} onOpenItem={onOpenItem} />);

    await user.click(screen.getByRole("button", { name: "Открыть: Зелье лечения" }));
    expect(onOpenItem).toHaveBeenCalledWith("healing-potion");
  });

  it("вторая строка вещи называет цену, прибавки и заметку — только то, что есть", () => {
    expect(itemMeta(potion)).toBe("50 зм");
    expect(
      itemMeta({
        id: "ring",
        nameRu: "Кольцо",
        kind: "gear",
        note: "фамильное",
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
      }),
    ).toBe("защита +1 · спасброски +1 · фамильное");
    expect(
      itemMeta({
        id: "staff",
        nameRu: "Посох",
        kind: "gear",
        bonuses: { spellcasting: 2, armorClass: 0, savingThrows: 0 },
      }),
    ).toBe("магия +2");
    expect(itemMeta({ id: "rope", nameRu: "Верёвка", kind: "other" })).toBe("");
    // Прибавка вне экипировки не действует — и потому не называется: показанное число лгало бы.
    expect(
      itemMeta({
        id: "old-potion",
        nameRu: "Странное зелье",
        kind: "consumable",
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
      }),
    ).toBe("");
  });

  it("доспех и деньги открывают свои шторки", async () => {
    const user = userEvent.setup();
    const onEditArmor = vi.fn();
    const onEditMoney = vi.fn();
    render(
      <Bag
        character={createThorne()}
        {...NOOP}
        onEditArmor={onEditArmor}
        onEditMoney={onEditMoney}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Править: Доспех" }));
    await user.click(screen.getByRole("button", { name: "Править: Деньги" }));
    expect(onEditArmor).toHaveBeenCalled();
    expect(onEditMoney).toHaveBeenCalled();
  });

  it("у экипировки счёт сумки и надетого называется числом всегда, у другой категории — только не единица", () => {
    const daggers: ItemDefinition = { id: "dagger", nameRu: "Кинжал", kind: "gear" };
    render(<Bag character={withStock([{ definition: daggers, bag: 2 }])} {...NOOP} />);
    expect(screen.getByText("Кинжал · сумка 2 · надето 0")).toBeDefined();

    cleanup();
    render(<Bag character={withStock([{ definition: potion, bag: 2 }])} {...NOOP} />);
    expect(screen.getByText("Зелье лечения ×2")).toBeDefined();

    cleanup();
    render(<Bag character={withStock([{ definition: potion, bag: 1 }])} {...NOOP} />);
    expect(screen.getByText("Зелье лечения")).toBeDefined();
  });
});
