// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { createWizard, withoutItems } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";

import { Bag } from "./Bag";

const spells = loadThorneSpells();

afterEach(cleanup);

const { stats } = toChoicesView();

const herb: ItemDefinition = {
  id: "herb",
  nameRu: "Подорожник",
  notes: [],
  kinds: [],
  alchemy: { properties: [] },
};

const ring: ItemDefinition = {
  id: "ring",
  nameRu: "Кольцо защиты",
  notes: [],
  kinds: ["gear"],
  bonuses: { armorClass: 1 },
};

function stateOf(
  entries: readonly { definition: ItemDefinition; bag?: number; worn?: number }[],
): CharacterState {
  const state = withoutItems(createWizard());
  return {
    ...state,
    itemDefinitions: entries.map((entry) => entry.definition),
    equipment: {
      ...state.equipment,
      bag: entries.map((entry) => ({ itemId: entry.definition.id, count: entry.bag ?? 0 })),
      worn: entries.map((entry) => ({ itemId: entry.definition.id, count: entry.worn ?? 0 })),
    },
  };
}

function renderBag(
  entries: readonly { definition: ItemDefinition; bag?: number; worn?: number }[],
  handlers: Partial<{
    onSpend: (id: string) => void;
    onStock: (id: string) => void;
    onOpenItem: (id: string) => void;
    onWriteMoney: (coins: Readonly<Record<string, number>>) => void;
  }> = {},
) {
  const view = toBagView(stateOf(entries), spells);
  return render(
    <Bag
      items={view.items}
      money={view.money}
      stats={stats}
      openedId={null}
      onOpenItem={handlers.onOpenItem ?? (() => {})}
      onSpend={handlers.onSpend ?? (() => {})}
      onStock={handlers.onStock ?? (() => {})}
      onWriteMoney={handlers.onWriteMoney ?? (() => {})}
    />,
  );
}

function shownNames(): string[] {
  return screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
}

describe("«Рюкзак» в «Вещах»", () => {
  it("строка называет число со своей единицей, надетое и признаки", () => {
    renderBag([
      { definition: herb, bag: 48 },
      { definition: ring, bag: 3, worn: 2 },
    ]);

    expect(shownNames()[0]).toContain("48порций");
    expect(shownNames()[1]).toContain("надето 2 из 5");
    expect(shownNames()[1]).toContain("+1 Класс Доспеха");
    expect(shownNames()[1]).toContain("Экипировка");
  });

  it("сито оставляет только названный признак и убирает отвергнутый", async () => {
    const user = userEvent.setup();
    renderBag([
      { definition: herb, bag: 4 },
      { definition: ring, bag: 1 },
    ]);

    await user.click(screen.getByRole("button", { name: "Признаки" }));
    await user.click(screen.getByRole("button", { name: "Ингредиент" }));
    expect(shownNames()).toHaveLength(1);
    expect(shownNames()[0]).toContain("Подорожник");

    await user.click(screen.getByRole("button", { name: "Ингредиент" }));
    expect(shownNames()).toHaveLength(1);
    expect(shownNames()[0]).toContain("Кольцо защиты");

    await user.click(screen.getByRole("button", { name: "Кроме: Ингредиент" }));
    expect(shownNames()).toHaveLength(2);
  });

  it("поиск ищет по названию и говорит, когда ничего не нашлось", async () => {
    const user = userEvent.setup();
    renderBag([
      { definition: herb, bag: 4 },
      { definition: ring, bag: 1 },
    ]);

    await user.type(screen.getByLabelText("Найти вещь"), "кольц");
    expect(shownNames()).toHaveLength(1);

    await user.clear(screen.getByLabelText("Найти вещь"));
    await user.type(screen.getByLabelText("Найти вещь"), "молот");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("Ничего не нашлось.")).toBeDefined();
  });

  it("надетое не тратится из сумки: при пустой сумке «−» погашен", () => {
    renderBag([{ definition: ring, bag: 0, worn: 1 }]);

    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Кольцо защиты" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Добавить один в сумку: Кольцо защиты" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("пустой рюкзак говорит, чего в нём нет", () => {
    const view = toBagView(withoutItems(createThorne()), spells);
    render(
      <Bag
        items={view.items.filter((item) => item.ownedCount > 0)}
        money={view.money}
        stats={stats}
        openedId={null}
        onOpenItem={() => {}}
        onSpend={() => {}}
        onStock={() => {}}
        onWriteMoney={() => {}}
      />,
    );

    expect(screen.getByText("При себе ничего нет.")).toBeDefined();
  });

  it("деньги правятся прямо в строке, а записываются ответом, а не вводом", async () => {
    const user = userEvent.setup();
    const onWriteMoney = vi.fn();
    renderBag([{ definition: ring, bag: 1 }], { onWriteMoney });

    await user.click(screen.getByRole("button", { name: "Деньги" }));
    const gold = screen.getByLabelText("зм");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.tab();
    expect(onWriteMoney).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Записать" }));
    expect(onWriteMoney).toHaveBeenCalledWith({ gold: 215, silver: 0, copper: 0 });
  });
});
