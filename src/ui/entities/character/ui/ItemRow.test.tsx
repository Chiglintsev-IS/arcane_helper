// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { materialOf } from "@/core/application/casting/material";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { ItemRow } from "./ItemRow";

const spells = loadThorneSpells();

afterEach(cleanup);

const { stats } = toChoicesView();

function viewOf(definition: ItemDefinition): ItemView {
  const state = createThorne();
  const found = toBagView({
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
  }, spells).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

function wornOf(id: string): ItemView {
  const found = toBagView(createThorne(), spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

function renderRow(item: ItemView, countRu?: string) {
  return render(
    <ul>
      <ItemRow
        item={item}
        stats={stats}
        {...(countRu === undefined ? {} : { countRu })}
        onOpen={() => {}}
      />
    </ul>,
  );
}

function factAt(valueRu: string): string {
  const value = screen.getByText(valueRu);
  return value.parentElement?.textContent ?? "";
}

const staff: ItemDefinition = {
  id: "staff-of-power",
  nameRu: "Посох силы",
  kind: "gear",
  note: "требует настройки",
  bonuses: { spellSaveDc: 2, spellAttackModifier: 2 },
};

describe("строка вещи", () => {
  it("число строки стоит при имени, а не отодвигает подробности (FR-250)", () => {
    renderRow(viewOf(staff), "надето 1");

    const open = screen.getByRole("button", { name: "Правка: Посох силы" });
    expect(within(open).getByText("надето 1")).toBeDefined();
  });

  it("факт — своя плашка: число один раз и всё, что оно двигает (FR-250)", () => {
    renderRow(
      viewOf({
        ...staff,
        bonuses: { armorClass: 1, spellSaveDc: 2, spellAttackModifier: 2 },
        price: { amount: 3500, currency: "gold" },
      }),
    );

    expect(factAt("+2")).toBe("+2 КС спасброска, Атака заклинанием");
    expect(factAt("+1")).toBe("+1 Класс Доспеха");
    expect(factAt("3500")).toBe("3500 зм");

    expect(screen.getByText("требует настройки")).toBeDefined();
  });

  it("прибавка не прячется за счётом: пять величин названы все (FR-250)", () => {
    renderRow(
      viewOf({
        id: "circlet-of-everything",
        nameRu: "Венец всего",
        kind: "gear",
        bonuses: {
          armorClass: 1,
          spellSaveDc: 1,
          spellAttackModifier: 1,
          initiative: 1,
          passivePerception: 1,
        },
      }),
    );

    expect(factAt("+1")).toBe(
      "+1 Класс Доспеха, КС спасброска, Атака заклинанием, Инициатива, Пассивная внимательность",
    );
    expect(screen.queryByText(/ещё/)).toBeNull();
  });

  it("однородное стоит одним фактом: шесть спасбросков не режутся счётом (FR-250)", () => {
    renderRow(wornOf("cloak-of-protection"));

    expect(factAt("+1")).toBe("+1 Класс Доспеха, Все спасброски");
    expect(screen.queryByText(/Спасбросок:/)).toBeNull();
  });

  it("строка вещи называет, чем вещь требуется (FR-295)", () => {
    const ritual = spells.find((spell) => spell.id === "arcane-lock");
    const material = ritual === undefined ? undefined : materialOf(ritual.components);
    if (material === undefined) throw new Error("«Волшебный замок» материала не требует");

    renderRow(viewOf(material));

    expect(screen.getByText("Требуется для: Волшебный замок")).toBeDefined();
    expect(factAt("25")).toBe("25 зм");
  });

  it("у вещи без подробностей второй строки нет вовсе (FR-250)", () => {
    renderRow(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }));

    const open = screen.getByRole("button", { name: "Правка: Верёвка" });
    expect(open.textContent).toBe("Верёвка");
  });
});
