// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { Bag } from "./Bag";

const spells = loadThorneSpells();

afterEach(cleanup);

const { stats } = toChoicesView();

const NOOP: Omit<ComponentProps<typeof Bag>, "bag"> = {
  stats,
  filter: "all",
  onChangeFilter: () => {},
  onEditMoney: () => {},
  onOpenItem: () => {},
  onAddItem: () => {},
  onAdjustBagCount: () => {},
  onAdjustWornCount: () => {},
};

function withStock(
  entries: { definition: ItemDefinition; bag?: number; worn?: number; wanted?: boolean }[],
): CharacterState {
  const state = createThorne();
  return {
    ...state,
    itemDefinitions: [...state.itemDefinitions, ...entries.map((entry) => entry.definition)],
    equipment: {
      ...state.equipment,
      bag: [
        ...state.equipment.bag,
        ...entries.map((entry) => ({ itemId: entry.definition.id, count: entry.bag ?? 0 })),
      ],
      worn: [
        ...state.equipment.worn,
        ...entries.map((entry) => ({ itemId: entry.definition.id, count: entry.worn ?? 0 })),
      ],
      wanted: entries.filter((entry) => entry.wanted === true).map((entry) => entry.definition.id),
    },
  };
}

const potion: ItemDefinition = {
  id: "healing-potion",
  nameRu: "Зелье лечения",
  kinds: ["consumable"],
  price: { amount: 50, currency: "gold" },
};

const ring: ItemDefinition = {
  id: "ring",
  nameRu: "Кольцо защиты",
  kinds: ["gear", "ingredient"],
  bonuses: { armorClass: 1 },
};

const shard: ItemDefinition = { id: "shard", nameRu: "Черепок", kinds: [] };

function shownNames(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "")
    .filter((text) => text !== "");
}

describe("«Сумка» в «Вещах»", () => {
  it("держит кошелёк, фильтры признаков и один список", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} />);

    const filters = within(screen.getByRole("radiogroup", { name: "Что в рюкзаке" }));
    expect(filters.getAllByRole("radio").map((button) => button.textContent)).toEqual([
      "Всё",
      "Экипировка",
      "Расходники",
      "Ингредиенты",
      "Другое",
    ]);

    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
    expect(screen.getByRole("list", { name: "Всё" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Защита" })).toBeNull();
  });

  it("в рюкзаке лежит только то, что при себе: кончившееся из него уходит", () => {
    const carried = withStock([{ definition: potion, bag: 1 }]);
    const empty = withStock([{ definition: potion, bag: 0, wanted: true }]);

    const { rerender } = render(<Bag bag={toBagView(carried, spells)} {...NOOP} />);
    expect(shownNames().join(" ")).toContain(potion.nameRu);

    rerender(<Bag bag={toBagView(empty, spells)} {...NOOP} />);
    expect(shownNames().join(" ")).not.toContain(potion.nameRu);
  });

  it("кошелёк показывает все три монеты стола, включая нули", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} />);
    const purse = screen.getByRole("list", { name: "Кошелёк" });
    expect(within(purse).getAllByRole("listitem")).toHaveLength(3);
    expect(purse.textContent).toContain("зм");
    expect(purse.textContent).toContain("см");
    expect(purse.textContent).toContain("мм");
  });

  it("фильтр по признаку показывает вещь со всеми её признаками разом", () => {
    const character = withStock([{ definition: ring, bag: 1 }, { definition: potion, bag: 2 }]);

    const { rerender } = render(
      <Bag bag={toBagView(character, spells)} {...NOOP} filter="gear" />,
    );
    expect(shownNames().join(" ")).toContain(ring.nameRu);
    expect(shownNames().join(" ")).not.toContain(potion.nameRu);

    rerender(<Bag bag={toBagView(character, spells)} {...NOOP} filter="ingredient" />);
    expect(shownNames().join(" ")).toContain(ring.nameRu);
  });

  it("«Другое» — вещь без признаков: находку не заставляют опознавать", () => {
    const character = withStock([{ definition: shard, bag: 1 }, { definition: potion, bag: 1 }]);
    render(<Bag bag={toBagView(character, spells)} {...NOOP} filter="other" />);

    expect(shownNames().join(" ")).toContain(shard.nameRu);
    expect(shownNames().join(" ")).not.toContain(potion.nameRu);
  });

  it("«Экипировка» показывает надетое и защиту, «Всё» защиту не показывает", () => {
    const character = withStock([{ definition: ring, bag: 1, worn: 1 }]);

    const { rerender } = render(
      <Bag bag={toBagView(character, spells)} {...NOOP} filter="gear" />,
    );
    expect(screen.getByRole("heading", { name: "Защита" })).toBeDefined();
    expect(shownNames().join(" ")).toContain(ring.nameRu);

    rerender(<Bag bag={toBagView(character, spells)} {...NOOP} filter="all" />);
    expect(screen.queryByRole("heading", { name: "Защита" })).toBeNull();
  });

  it("строка называет оба счёта: надетое и запас в сумке", () => {
    const character = withStock([{ definition: ring, bag: 4, worn: 1 }]);
    render(<Bag bag={toBagView(character, spells)} {...NOOP} filter="gear" />);

    const row = within(screen.getByRole("list", { name: "Экипировка" }))
      .getAllByRole("listitem")
      .find((candidate) => (candidate.textContent ?? "").includes(ring.nameRu));
    expect(row?.textContent).toContain("надето 1");
    expect(row?.textContent).toContain("в сумке 4");
  });

  it("запас меняется кнопками строки: минус и плюс", async () => {
    const user = userEvent.setup();
    const onAdjustBagCount = vi.fn();
    render(
      <Bag
        bag={toBagView(withStock([{ definition: potion, bag: 3 }]), spells)}
        {...NOOP}
        filter="consumable"
        onAdjustBagCount={onAdjustBagCount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));

    expect(onAdjustBagCount).toHaveBeenNthCalledWith(1, "healing-potion", -1);
    expect(onAdjustBagCount).toHaveBeenNthCalledWith(2, "healing-potion", 1);
  });

  it("надевают и снимают со строки, и только экипировку", async () => {
    const user = userEvent.setup();
    const onAdjustWornCount = vi.fn();
    const character = withStock([{ definition: ring, bag: 1 }, { definition: potion, bag: 1 }]);
    render(
      <Bag
        bag={toBagView(character, spells)}
        {...NOOP}
        onAdjustWornCount={onAdjustWornCount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));
    expect(onAdjustWornCount).toHaveBeenCalledWith("ring", 1);
    expect(screen.queryByRole("button", { name: "Надеть один: Зелье лечения" })).toBeNull();
  });

  it("быстрый ввод заводит вещь с признаком показанного фильтра", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(
      <Bag
        bag={toBagView(createThorne(), spells)}
        {...NOOP}
        filter="consumable"
        onAddItem={onAddItem}
      />,
    );

    await user.type(screen.getByLabelText("Новый расходник"), "Свиток огненного шара{Enter}");
    expect(onAddItem).toHaveBeenCalledWith(["consumable"], "Свиток огненного шара");

    await user.type(screen.getByLabelText("Новый расходник"), "{Enter}");
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  it("пустой список говорит, чего в нём нет", () => {
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} filter="consumable" />);
    expect(screen.getByText("Расходников при себе нет.")).toBeDefined();
  });

  it("нажатие на вещь открывает её целиком", async () => {
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

  it("фильтр переключается нажатием и говорит, какой выбран", async () => {
    const user = userEvent.setup();
    const onChangeFilter = vi.fn();
    render(
      <Bag bag={toBagView(createThorne(), spells)} {...NOOP} onChangeFilter={onChangeFilter} />,
    );

    expect(screen.getByRole("radio", { name: "Всё" })).toHaveProperty("ariaChecked", "true");
    await user.click(screen.getByRole("radio", { name: "Расходники" }));
    expect(onChangeFilter).toHaveBeenCalledWith("consumable");
  });

  it("деньги правятся своей шторкой, и открывает её строка кошелька", async () => {
    const user = userEvent.setup();
    const onEditMoney = vi.fn();
    render(<Bag bag={toBagView(createThorne(), spells)} {...NOOP} onEditMoney={onEditMoney} />);

    await user.click(screen.getByRole("button", { name: "Правка: Деньги" }));
    expect(onEditMoney).toHaveBeenCalled();
  });
});
