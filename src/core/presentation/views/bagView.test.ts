/**
 * Проекция сумки: вещь вместе со своим запасом.
 *
 * Соединение здесь и проверяется: «что это такое» знают вещи, «сколько этого у меня» — снаряжение,
 * и до проекции их никто не сводил. Заодно — что защита называет доспех, по которому её считают.
 */

import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";

import { toBagView } from "./bagView";

/** Персонаж с заведённой вещью и её запасом — поверх обычного снаряжения Торна. */
function withStock(definition: ItemDefinition, stock: { bag?: number; worn?: number } = {}): CharacterState {
  const state = createThorne();
  return {
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
    equipment: {
      ...state.equipment,
      bag: [...state.equipment.bag, { itemId: definition.id, count: stock.bag ?? 0 }],
      worn: [...state.equipment.worn, { itemId: definition.id, count: stock.worn ?? 0 }],
    },
  };
}

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kind: "other" };

function itemOf(character: CharacterState, id: string) {
  const found = toBagView(character).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("деньги", () => {
  it("все монеты стола едут в порядке достоинства, включая нули", () => {
    expect(toBagView(createThorne()).money.map((coin) => coin.currency)).toEqual([
      "gold",
      "silver",
      "copper",
    ]);
    expect(toBagView(createThorne()).money.every((coin) => coin.amount >= 0)).toBe(true);
  });
});

describe("вещи", () => {
  it("вещь приезжает со своим запасом: в сумке и надетым", () => {
    expect(itemOf(withStock(rope, { bag: 3 }), "rope")).toMatchObject({
      nameRu: "Верёвка",
      kind: "other",
      bagCount: 3,
      wornCount: 0,
    });
  });

  it("прибавки едут списком величин, а цена и заметка — только если они есть", () => {
    const ring: ItemDefinition = {
      id: "ring",
      nameRu: "Кольцо",
      kind: "gear",
      note: "фамильное",
      price: { amount: 50, currency: "gold" },
      bonuses: { armorClass: 1 },
    };

    expect(itemOf(withStock(ring), "ring")).toMatchObject({
      price: { amount: 50, currency: "gold" },
      bonuses: [{ stat: "armorClass", value: 1 }],
      note: "фамильное",
    });
    expect(itemOf(withStock(rope), "rope")).toMatchObject({ bonuses: [] });
  });
});

describe("защита", () => {
  it("без доспеха защита своего доспеха не называет", () => {
    expect(toBagView(createThorne()).armorClass).toEqual({ value: 14 });
  });

  it("надетый доспех назван тем именем, под которым он и считает", () => {
    const armored = withStock(
      { id: "scale-mail", nameRu: "Чешуйчатый доспех", kind: "gear", armor: { base: 14 } },
      { worn: 1 },
    );

    expect(toBagView(armored).armorClass).toEqual({ value: 18, wornArmorNameRu: "Чешуйчатый доспех" });
  });
});
