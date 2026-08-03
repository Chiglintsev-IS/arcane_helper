// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { InventoryItem } from "@/core/domain/equipment/schema";
import { Bag, itemMeta } from "./Bag";

afterEach(cleanup);

const NOOP = {
  onEditMoney: () => {},
  onOpenItem: () => {},
  onAddItem: () => {},
  onToggleWorn: () => {},
  onAdjustCount: () => {},
  onEditArmor: () => {},
};

function withItems(items: InventoryItem[]): CharacterState {
  const state = createThorne();
  return { ...state, equipment: { ...state.equipment, items } };
}

const potion: InventoryItem = {
  id: "healing-potion",
  nameRu: "Зелье лечения",
  kind: "consumable",
  worn: false,
  count: 3,
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
    render(<Bag character={withItems([potion])} {...NOOP} />);

    const consumables = screen.getByRole("list", { name: "Расходники" });
    expect(within(consumables).getByText("Зелье лечения ×3")).toBeDefined();
    // Раздел без вещей списка не держит, но строка ввода в нём есть.
    expect(screen.queryByRole("list", { name: "Ингредиенты" })).toBeNull();
    expect(screen.getByLabelText("Новый ингредиент")).toBeDefined();
  });

  it("счётный раздел меняет запас с строки: минус и плюс (FR-239)", async () => {
    const user = userEvent.setup();
    const onAdjustCount = vi.fn();
    render(<Bag character={withItems([potion])} {...NOOP} onAdjustCount={onAdjustCount} />);

    await user.click(screen.getByRole("button", { name: "Потратить один: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Добавить один: Зелье лечения" }));

    expect(onAdjustCount).toHaveBeenNthCalledWith(1, "healing-potion", -1);
    expect(onAdjustCount).toHaveBeenNthCalledWith(2, "healing-potion", 1);
  });

  it("ноль — состояние: кончившийся расходник виден нулём, а минус выключен (FR-239)", () => {
    render(<Bag character={withItems([{ ...potion, count: 0 }])} {...NOOP} />);

    expect(screen.getByText("Зелье лечения ×0")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Потратить один: Зелье лечения" }),
    ).toHaveProperty("disabled", true);
  });

  it("экипировка надевается со строки, счёта у неё нет (FR-238)", async () => {
    const user = userEvent.setup();
    const onToggleWorn = vi.fn();
    render(<Bag character={createThorne()} {...NOOP} onToggleWorn={onToggleWorn} />);

    await user.click(screen.getByRole("switch", { name: "Надето: Плащ защиты" }));
    expect(onToggleWorn).toHaveBeenCalledWith("cloak-of-protection");
    expect(screen.queryByRole("button", { name: "Потратить один: Плащ защиты" })).toBeNull();
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
    render(<Bag character={withItems([potion])} {...NOOP} onOpenItem={onOpenItem} />);

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
        worn: true,
        count: 1,
        note: "фамильное",
        bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
      }),
    ).toBe("защита +1 · спасброски +1 · фамильное");
    expect(
      itemMeta({
        id: "staff",
        nameRu: "Посох",
        kind: "gear",
        worn: false,
        count: 1,
        bonuses: { spellcasting: 2, armorClass: 0, savingThrows: 0 },
      }),
    ).toBe("магия +2");
    expect(itemMeta({ id: "rope", nameRu: "Верёвка", kind: "other", worn: false, count: 1 })).toBe("");
    // Прибавка вне экипировки не действует — и потому не называется: показанное число лгало бы.
    expect(
      itemMeta({
        id: "old-potion",
        nameRu: "Странное зелье",
        kind: "consumable",
        worn: false,
        count: 1,
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

  it("у экипировки счёт больше единицы виден, единица — нет", () => {
    const daggers: InventoryItem = { id: "dagger", nameRu: "Кинжал", kind: "gear", worn: false, count: 2 };
    render(<Bag character={withItems([daggers])} {...NOOP} />);
    expect(screen.getByText("Кинжал ×2")).toBeDefined();

    cleanup();
    render(<Bag character={withItems([{ ...daggers, count: 1 }])} {...NOOP} />);
    expect(screen.getByText("Кинжал")).toBeDefined();
  });
});
