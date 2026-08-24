/**
 * Проекция сумки: вещь вместе со своим запасом.
 *
 * Соединение здесь и проверяется: «что это такое» знают вещи, «сколько этого у меня» — снаряжение,
 * и до проекции их никто не сводил. Заодно — что защита называет доспех, по которому её считают.
 */

import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";

import { Character } from "@/core/domain/assembly/character";
import { materialOf } from "@/core/application/casting/material";

import { toBagView } from "./bagView";

/** Карточки, по которым идёт игра: требование вещи называет карточка, а не вещь. */
const spells = loadThorneSpells();

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

  it("доспех едет базой и родом, а неопознанная находка — одной базой", () => {
    const mail: ItemDefinition = {
      id: "mail",
      nameRu: "Кольчуга",
      kind: "gear",
      armor: { base: 16, category: "medium" },
    };
    const found: ItemDefinition = {
      id: "found",
      nameRu: "Находка",
      kind: "gear",
      armor: { base: 12 },
    };

    expect(itemOf(withStock(mail), "mail").armor).toEqual({ base: 16, category: "medium" });
    expect(itemOf(withStock(found), "found").armor).toEqual({ base: 12 });
    // Вещь, доспехом не являющаяся, о защите молчит вовсе.
    expect(itemOf(withStock(rope), "rope").armor).toBeUndefined();
  });
});

describe("защита", () => {
  it("без доспеха защита своего доспеха не называет", () => {
    expect(toBagView(createThorne(), spells).armorClass).toEqual({ value: 14 });
  });

  it("надетый доспех назван тем именем, под которым он и считает", () => {
    const armored = withStock(
      { id: "scale-mail", nameRu: "Чешуйчатый доспех", kind: "gear", armor: { base: 14 } },
      { worn: 1 },
    );

    expect(toBagView(armored, spells).armorClass).toEqual({ value: 18, wornArmorNameRu: "Чешуйчатый доспех" });
  });
});

/** Компонент, заведённый вещью: её заводит та же операция, что и всякую покупку. */
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

const charcoalId = "золотая-пыль-стоимостью-минимум-25-зм,-расходуемая-заклинанием";

describe("чем вещь требуется", () => {
  it("вещь называет тех, кто её требует, а сама о них не знает (FR-295)", () => {
    const bought = withComponentOf("arcane-lock");
    const charcoal = toBagView(bought, spells).items.find(
      (item) =>
        item.nameRu ===
        "золотая пыль стоимостью минимум 25 зм, расходуемая заклинанием",
    );

    expect(charcoal?.neededForRu).toEqual(["Волшебный замок"]);
    // Записи о потребителях у самой вещи нет: без карточек требование не собирается вовсе.
    expect(toBagView(bought, []).items.every((item) => item.neededForRu.length === 0)).toBe(true);
  });

  it("вещь, которой никто не требует, о требованиях молчит", () => {
    expect(itemOf(withStock(rope), "rope").neededForRu).toEqual([]);
  });
});

describe("чего не хватает", () => {
  it("в списке покупок стоит то, без чего не сотворить, и срочное идёт первым (FR-296)", () => {
    const missing = toBagView(createThorne(), spells).missingMaterials;

    // Срочное впереди: без него сотворить нельзя, а закрытое фокусировкой лишь ждёт её снятия.
    expect(missing.filter((need) => !need.coveredByFocus).map((need) => need.spellId)).toEqual([
      "arcane-lock",
    ]);
    expect(missing.slice(0, 1).every((need) => !need.coveredByFocus)).toBe(true);
    expect(missing.slice(1).every((need) => need.coveredByFocus)).toBe(true);

    // Цену и судьбу называет карточка: приложение их не выдумывает.
    expect(missing[0]).toMatchObject({
      consumed: true,
      price: { amount: 25, currency: "gold" },
      neededForRu: ["Волшебный замок"],
    });
  });

  it("истраченная до нуля вещь стоит в списке покупок со всем, что у неё было (FR-302)", () => {
    const bought = withComponentOf("arcane-lock");
    // Лежащее в сумке покупать не надо: пока запас есть, вещь в список покупок не едет.
    expect(toBagView(bought, spells).missingMaterials.some((need) => need.itemId === charcoalId)).toBe(
      false,
    );

    const root = Character.of(bought);
    const emptied = root.withEquipment(root.equipment.adjustBagCount(charcoalId, -1)).toState();
    const view = toBagView(emptied, spells);

    // Ноль требуемого — вопрос лавки, и вещь едет строкой со всем, что у неё было.
    expect(view.missingMaterials.find((need) => need.spellId === "arcane-lock")).toMatchObject({
      itemId: charcoalId,
      price: { amount: 25, currency: "gold" },
      neededForRu: ["Волшебный замок"],
    });
    // Запись никуда не делась: ею вещь открывают и ею же пополняют.
    expect(view.items.find((item) => item.id === charcoalId)?.bagCount).toBe(0);

    // Написанное рукой едет со строкой: переезд не отнимает у неё ничего.
    const stored = Character.of(emptied).items.find(charcoalId);
    if (stored === undefined) throw new Error("золотая пыль не заведена");
    const shop = "у ювелира в порту";
    const noted = Character.of(emptied);
    const withNote = noted.withItems(noted.items.replaceDefinition({ ...stored, note: shop }));
    expect(
      toBagView(withNote.toState(), spells).missingMaterials.find((need) => need.itemId === charcoalId)
        ?.note,
    ).toBe(shop);
  });

  it("вещь, которой не требует никто, с нулём в список покупок не едет (FR-302)", () => {
    const view = toBagView(withStock(rope, { bag: 0 }), spells);

    expect(view.items.find((item) => item.id === "rope")?.bagCount).toBe(0);
    expect(view.missingMaterials.some((need) => need.nameRu === rope.nameRu)).toBe(false);
  });
});
