// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { createWizard, withoutItems } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { toBagView } from "@/core/presentation/views/bagView";

import { MetItems } from "./MetItems";

const spells = loadThorneSpells();

afterEach(cleanup);

const potion: ItemDefinition = {
  id: "potion",
  nameRu: "Зелье лечения",
  kinds: [],
  notes: [{ id: "n1", textRu: "лавка в Гнилом Броде" }],
};

const mail: ItemDefinition = {
  id: "mail",
  nameRu: "Мифриловая кольчуга",
  kinds: ["gear"],
  notes: [{ id: "n1", textRu: "видели у дварфа-торговца" }],
};

function stateOf(
  entries: readonly { definition: ItemDefinition; bag?: number; wanted?: boolean }[],
): CharacterState {
  const state = withoutItems(createWizard());
  return {
    ...state,
    itemDefinitions: entries.map((entry) => entry.definition),
    equipment: {
      ...state.equipment,
      bag: entries.map((entry) => ({ itemId: entry.definition.id, count: entry.bag ?? 0 })),
      wanted: entries.filter((entry) => entry.wanted === true).map((entry) => entry.definition.id),
    },
  };
}

function renderMet(
  entries: readonly { definition: ItemDefinition; bag?: number; wanted?: boolean }[],
  onToggleWanted: (id: string) => void = () => {},
) {
  return render(
    <MetItems
      items={toBagView(stateOf(entries), spells).items}
      openedId={null}
      onOpenItem={() => {}}
      onToggleWanted={onToggleWanted}
    />,
  );
}

describe("«Встречалось» в «Вещах»", () => {
  it("строка называет состояние и то, где вещь видели", () => {
    renderMet([
      { definition: potion, bag: 2 },
      { definition: mail, wanted: true },
    ]);

    const rows = screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("при себе");
    expect(rows[0]).toContain("лавка в Гнилом Броде");
    expect(rows[1]).toContain("нет при себе");
    expect(rows[1]).toContain("видели у дварфа-торговца");
  });

  it("выборки считают свои строки: всё, при себе и отмеченное к покупке", async () => {
    const user = userEvent.setup();
    renderMet([
      { definition: potion, bag: 2 },
      { definition: mail, wanted: true },
    ]);

    expect(screen.getByRole("radio", { name: /Всё/ }).textContent).toContain("2");
    expect(screen.getByRole("radio", { name: /При себе/ }).textContent).toContain("1");

    await user.click(screen.getByRole("radio", { name: /Купить/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByRole("listitem")[0]?.textContent).toContain("Мифриловая кольчуга");
  });

  it("отметка «в покупки» ставится прямо из списка", async () => {
    const user = userEvent.setup();
    const onToggleWanted = vi.fn();
    renderMet([{ definition: potion, bag: 0 }], onToggleWanted);

    await user.click(screen.getByRole("button", { name: "в покупки: Зелье лечения" }));
    expect(onToggleWanted).toHaveBeenCalledWith("potion");
  });
});
