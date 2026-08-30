// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { ItemBase } from "./ItemBase";

const spells = loadThorneSpells();

afterEach(cleanup);

const { stats } = toChoicesView();

const NOOP: Omit<ComponentProps<typeof ItemBase>, "bag"> = {
  stats,
  filter: "all",
  onChangeFilter: () => {},
  onEditMoney: () => {},
  onOpenItem: () => {},
  onRecordItem: () => {},
  onAdjustBagCount: () => {},
  onAdjustWornCount: () => {},
};

function withStock(
  entries: { definition: ItemDefinition; bag?: number; wanted?: boolean }[],
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

const shard: ItemDefinition = { id: "shard", nameRu: "Черепок", kinds: [] };

function shownNames(): string {
  return screen
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "")
    .join(" ");
}

describe("«Все вещи»", () => {
  it("держит кошелёк, поиск и фильтры, среди которых покупки", () => {
    render(<ItemBase bag={toBagView(createThorne(), spells)} {...NOOP} />);

    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
    expect(screen.getByLabelText("Поиск")).toBeDefined();

    const filters = within(screen.getByRole("radiogroup", { name: "Какие вещи" }));
    expect(filters.getAllByRole("radio").map((button) => button.textContent)).toEqual([
      "Всё",
      "Покупки",
      "Нет при себе",
      "Экипировка",
      "Расходники",
      "Ингредиенты",
      "Другое",
    ]);
  });

  it("показывает заведённое независимо от запаса: и то, что при себе, и то, чего нет", () => {
    const character = withStock([{ definition: potion, bag: 0 }, { definition: shard, bag: 2 }]);
    render(<ItemBase bag={toBagView(character, spells)} {...NOOP} />);

    expect(shownNames()).toContain(potion.nameRu);
    expect(shownNames()).toContain(shard.nameRu);
  });

  it("«Покупки» — фильтр базы: желаемое видно, даже когда оно уже лежит в сумке", () => {
    const character = withStock([
      { definition: potion, bag: 2, wanted: true },
      { definition: shard, bag: 1 },
    ]);
    render(<ItemBase bag={toBagView(character, spells)} {...NOOP} filter="wanted" />);

    expect(shownNames()).toContain(potion.nameRu);
    expect(shownNames()).not.toContain(shard.nameRu);
  });

  it("«Нет при себе» отделяет кончившееся и записанное от лежащего в сумке", () => {
    const character = withStock([{ definition: potion, bag: 0 }, { definition: shard, bag: 1 }]);
    render(<ItemBase bag={toBagView(character, spells)} {...NOOP} filter="absent" />);

    expect(shownNames()).toContain(potion.nameRu);
    expect(shownNames()).not.toContain(shard.nameRu);
  });

  it("признак фильтрует базу, не спрашивая о запасе", () => {
    const character = withStock([{ definition: potion, bag: 0 }, { definition: shard, bag: 3 }]);
    render(<ItemBase bag={toBagView(character, spells)} {...NOOP} filter="consumable" />);

    expect(shownNames()).toContain(potion.nameRu);
    expect(shownNames()).not.toContain(shard.nameRu);
  });

  it("поиск отбирает по имени и говорит, когда не нашлось ничего", async () => {
    const user = userEvent.setup();
    const character = withStock([{ definition: potion, bag: 1 }, { definition: shard, bag: 1 }]);
    render(<ItemBase bag={toBagView(character, spells)} {...NOOP} />);

    await user.type(screen.getByLabelText("Поиск"), "зель");
    expect(shownNames()).toContain(potion.nameRu);
    expect(shownNames()).not.toContain(shard.nameRu);

    await user.clear(screen.getByLabelText("Поиск"));
    await user.type(screen.getByLabelText("Поиск"), "перо феникса");
    expect(screen.getByText("Ничего не нашлось.")).toBeDefined();
  });

  it("ввод записывает встреченное без запаса, а под покупками — с отметкой", async () => {
    const user = userEvent.setup();
    const onRecordItem = vi.fn();
    const { rerender } = render(
      <ItemBase
        bag={toBagView(createThorne(), spells)}
        {...NOOP}
        onRecordItem={onRecordItem}
      />,
    );

    await user.type(screen.getByLabelText("Просто запомнить"), "Зелье невидимости{Enter}");
    expect(onRecordItem).toHaveBeenCalledWith("Зелье невидимости", false);

    rerender(
      <ItemBase
        bag={toBagView(createThorne(), spells)}
        {...NOOP}
        filter="wanted"
        onRecordItem={onRecordItem}
      />,
    );
    await user.type(screen.getByLabelText("Что купить"), "Верёвка{Enter}");
    expect(onRecordItem).toHaveBeenNthCalledWith(2, "Верёвка", true);
  });

  it("из базы вещь кладут в сумку и надевают, не уходя со списка", async () => {
    const user = userEvent.setup();
    const onAdjustBagCount = vi.fn();
    const character = withStock([{ definition: potion, bag: 0 }]);
    render(
      <ItemBase
        bag={toBagView(character, spells)}
        {...NOOP}
        onAdjustBagCount={onAdjustBagCount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));
    expect(onAdjustBagCount).toHaveBeenCalledWith("healing-potion", 1);
  });

  it("нажатие на вещь открывает её целиком", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(
      <ItemBase
        bag={toBagView(withStock([{ definition: potion, bag: 1 }]), spells)}
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
      <ItemBase
        bag={toBagView(createThorne(), spells)}
        {...NOOP}
        onChangeFilter={onChangeFilter}
      />,
    );

    expect(screen.getByRole("radio", { name: "Всё" })).toHaveProperty("ariaChecked", "true");
    await user.click(screen.getByRole("radio", { name: "Покупки" }));
    expect(onChangeFilter).toHaveBeenCalledWith("wanted");
  });

  it("деньги правятся своей шторкой, и открывает её строка кошелька", async () => {
    const user = userEvent.setup();
    const onEditMoney = vi.fn();
    render(
      <ItemBase bag={toBagView(createThorne(), spells)} {...NOOP} onEditMoney={onEditMoney} />,
    );

    await user.click(screen.getByRole("button", { name: "Правка: Деньги" }));
    expect(onEditMoney).toHaveBeenCalled();
  });

  it("пустой список говорит, чего в нём нет", () => {
    render(<ItemBase bag={toBagView(createThorne(), spells)} {...NOOP} filter="wanted" />);
    expect(screen.getByText("Купить пока нечего.")).toBeDefined();
  });
});
