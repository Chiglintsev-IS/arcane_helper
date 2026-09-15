// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { createWizard, withoutItems } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { toBagView } from "@/core/presentation/views/bagView";

import { Shopping } from "./Shopping";

const spells = loadThorneSpells();

afterEach(cleanup);

const mail: ItemDefinition = {
  id: "mail",
  nameRu: "Мифриловая кольчуга",
  kinds: ["gear"],
  notes: [{ id: "n1", textRu: "видели у дварфа-торговца" }],
  price: { gold: 4000, silver: 0, copper: 0 },
};

const cage: ItemDefinition = {
  id: "cage",
  nameRu: "Клетка для фамильяра",
  kinds: [],
  notes: [],
};

function stateOf(gold: number, definitions: readonly ItemDefinition[]): CharacterState {
  const state = withoutItems(createWizard());
  return {
    ...state,
    itemDefinitions: [...definitions],
    equipment: {
      ...state.equipment,
      money: { gold, silver: 0, copper: 0 },
      wanted: definitions.map((definition) => definition.id),
    },
  };
}

function renderShopping(gold: number, onBuy: (id: string) => void = () => {}) {
  const view = toBagView(stateOf(gold, [mail, cage]), spells);
  return render(
    <Shopping
      items={view.items.filter((item) => item.wanted)}
      money={view.money}
      shopping={view.shopping}
      bought={[]}
      onBuy={onBuy}
    />,
  );
}

describe("«Покупки» в «Вещах»", () => {
  it("итог, остаток кошелька и записи без цены стоят над списком", () => {
    renderShopping(7800);

    const header = screen.getByText("Нужно на всё").parentElement?.parentElement;
    expect(header?.textContent).toContain("4000 зм");
    expect(header?.textContent).toContain("останется 3800 зм");
    expect(header?.textContent).toContain("1 запись без цены");
  });

  it("нехватку денег список называет словом, а не гашением строки", () => {
    renderShopping(100);

    expect(screen.getByText(/не хватает/).textContent).toContain("3900 зм");
  });

  it("нажатие покупает вещь и больше её не предлагает", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    renderShopping(7800, onBuy);

    await user.click(screen.getByRole("button", { name: "Купить: Мифриловая кольчуга" }));
    expect(onBuy).toHaveBeenCalledWith("mail");
  });
});
