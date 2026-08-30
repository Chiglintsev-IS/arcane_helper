import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";

import { Character } from "@/core/domain/assembly/character";
import { materialOf } from "@/core/application/casting/material";

import { toBagView } from "./bagView";

const spells = loadThorneSpells();

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

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kinds: [] };

function itemOf(character: CharacterState, id: string) {
  const found = toBagView(character, spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("деньги", () => {
  it("все монеты стола едут в порядке достоинства, включая нули", () => {
    expect(toBagView(createThorne(), spells).money.map((coin) => coin.currency)).toEqual([
      "gold",
      "silver",
      "copper",
    ]);
    expect(toBagView(createThorne(), spells).money.every((coin) => coin.amount >= 0)).toBe(true);
  });
});

describe("вещи", () => {
  it("вещь приезжает со своим запасом: в сумке и надетым", () => {
    expect(itemOf(withStock(rope, { bag: 3 }), "rope")).toMatchObject({
      nameRu: "Верёвка",
      kinds: [],
      bagCount: 3,
      wornCount: 0,
    });
  });

  it("прибавки едут списком величин, а цена и заметка — только если они есть", () => {
    const ring: ItemDefinition = {
      id: "ring",
      nameRu: "Кольцо",
      kinds: ["gear"],
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
  it("без способа счёта защита никого не называет", () => {
    expect(toBagView(createThorne(), spells).armorClass).toEqual({ value: 14 });
  });

  it("надетая вещь двигает защиту прибавкой, и защита стоит одним числом", () => {
    const armored = withStock(
      { id: "bracers", nameRu: "Наручи защиты", kinds: ["gear"], bonuses: { armorClass: 2 } },
      { worn: 1 },
    );

    expect(toBagView(armored, spells).armorClass).toEqual({ value: 16 });
  });
});

function withComponentOf(spellId: string): CharacterState {
  const spell = spells.find((candidate) => candidate.id === spellId);
  if (spell === undefined) throw new Error(`нет карточки ${spellId}`);
  const material = materialOf(spell.components);
  if (material === undefined) throw new Error(`«${spell.nameRu}» материала не требует`);

  const root = Character.of(createThorne());
  return root
    .withItems(root.items.addDefinition(material))
    .withEquipment(root.equipment.adjustBagCount(material.id, 1))
    .toState();
}

describe("чем вещь требуется", () => {
  it("вещь называет тех, кто её требует, а сама о них не знает (FR-295)", () => {
    const bought = withComponentOf("arcane-lock");
    const charcoal = toBagView(bought, spells).items.find(
      (item) =>
        item.nameRu ===
        "золотая пыль стоимостью минимум 25 зм, расходуемая заклинанием",
    );

    expect(charcoal?.neededForRu).toEqual(["Волшебный замок"]);
    expect(toBagView(bought, []).items.every((item) => item.neededForRu.length === 0)).toBe(true);
  });

  it("вещь, которой никто не требует, о требованиях молчит", () => {
    expect(itemOf(withStock(rope), "rope").neededForRu).toEqual([]);
  });
});

describe("покупки", () => {
  it("вещь называет, хочет ли её игрок купить", () => {
    const wanted = withStock(rope, { bag: 0 });
    expect(itemOf(wanted, "rope").wanted).toBe(false);

    const root = Character.of(wanted);
    const wishing = root.withEquipment(root.equipment.withWanted("rope", true)).toState();
    expect(itemOf(wishing, "rope").wanted).toBe(true);
  });

  it("условие действия прибавки едет отметкой", () => {
    const stone: ItemDefinition = {
      id: "stone",
      nameRu: "Камень удачи",
      kinds: [],
      bonuses: { initiative: 1 },
      worksCarried: true,
    };
    expect(itemOf(withStock(stone, { bag: 1 }), "stone").worksCarried).toBe(true);
    expect(itemOf(withStock(rope, { bag: 1 }), "rope").worksCarried).toBe(false);
  });
});
