import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import {
  ITEMS_FIELDS,
  alignedItemDefinition,
  countedCarried,
  filledWearableOnlyFields,
  itemDefinitionOf,
  wearable,
  withoutWearableOnlyFields,
} from "@/core/domain/items/schema";
import type { ItemDefinition } from "@/core/domain/items/schema";

const potion: ItemDefinition = { id: "potion", nameRu: "Зелье", kinds: [], notes: [] };
const armored: ItemDefinition = {
  id: "chainmail",
  nameRu: "Кольчуга",
  notes: [],
  kinds: ["gear"],
  spellcastingFocus: true,
  bonuses: { armorClass: 0 },
};

function withDefinition(item: unknown) {
  return ITEMS_FIELDS.itemDefinitions.safeParse([item]);
}

describe("подсхема вещи", () => {
  it("вещь без признаков заводится: находку не заставляют опознавать", () => {
    const parsed = ITEMS_FIELDS.itemDefinitions.parse([{ id: "rope", nameRu: "Верёвка" }]);
    expect(parsed[0]?.kinds).toEqual([]);
  });

  it("признак ставится известный, и выдуманного признака не бывает", () => {
    expect(withDefinition({ id: "thing", nameRu: "Штука", kinds: ["gear"] }).success).toBe(true);
    expect(withDefinition({ id: "thing", nameRu: "Штука", kinds: ["potion"] }).success).toBe(false);
  });

  it("порядок и повторы признаков приводятся: набор один, как ни набирай", () => {
    const messy = itemDefinitionOf({
      id: "thing",
      nameRu: "Штука",
      kinds: ["gear", "gear"],
    });
    expect(messy.kinds).toEqual(["gear"]);
  });

  it("цена вещи необязательна, а заданная считает каждый номинал целым от нуля", () => {
    const priced = (price: unknown) => withDefinition({ id: "thing", nameRu: "Штука", price });
    expect(withDefinition({ id: "thing", nameRu: "Штука" }).success).toBe(true);
    expect(priced({ gold: 1, copper: 3 }).success).toBe(true);
    expect(priced({}).success).toBe(true);
    expect(priced({ gold: -1 }).success).toBe(false);
    expect(priced({ gold: 1.5 }).success).toBe(false);

    /* Цена без единой ненулевой монеты — не цена в ноль, а неназванная: при вещи её не хранят. */
    const strange = priced({ рубль: 50 });
    expect(strange.success && strange.data[0]?.price).toBeUndefined();
    const zeroed = priced({ gold: 0, silver: 0, copper: 0 });
    expect(zeroed.success && zeroed.data[0]?.price).toBeUndefined();
    const withCopper = priced({ copper: 3 });
    expect(withCopper.success && withCopper.data[0]?.price).toEqual({
      gold: 0,
      silver: 0,
      copper: 3,
    });
  });

  it("фокусировка бывает только у экипировки", () => {
    const spellcastingFocus = true;
    expect(withDefinition({ ...potion, spellcastingFocus }).success).toBe(false);
    expect(withDefinition({ ...potion, kinds: ["gear"], spellcastingFocus }).success).toBe(true);
    expect(withDefinition({ ...potion, kinds: ["gear"], spellcastingFocus: false }).success).toBe(
      false,
    );
  });

  it("прибавка не-экипировки действует при себе, иначе отказ", () => {
    const bonuses = { armorClass: 1 };
    expect(withDefinition({ ...potion, bonuses }).success).toBe(false);
    expect(withDefinition({ ...potion, bonuses, worksCarried: true }).success).toBe(true);
    expect(withDefinition({ ...potion, kinds: ["gear"], bonuses }).success).toBe(true);
  });

  it("условие действия без прибавок не хранится", () => {
    expect("worksCarried" in itemDefinitionOf({ ...potion, worksCarried: true })).toBe(false);
  });

  it("прибавка называет величину словаря, и выдуманной величины не бывает", () => {
    const gear = { id: "ring", nameRu: "Кольцо", kinds: ["gear"] };
    expect(withDefinition({ ...gear, bonuses: { "save:wisdom": 1 } }).success).toBe(true);
    expect(withDefinition({ ...gear, bonuses: { savingThrows: 1 } }).success).toBe(false);
    expect(withDefinition({ ...gear, bonuses: { armorClass: 1.5 } }).success).toBe(false);
  });

  it("отказ называет вещь по имени и говорит, чего ей не хватает", () => {
    expect(() => itemDefinitionOf({ ...potion, spellcastingFocus: true })).toThrow(/Зелье/);
    expect(() => itemDefinitionOf({ ...potion, bonuses: { armorClass: 1 } })).toThrow(/при себе/);
  });
});

describe("свойства экипировки: перечисление, снятие", () => {
  it("заполненные свойства экипировки перечисляются", () => {
    expect(filledWearableOnlyFields(armored)).toEqual(["spellcastingFocus"]);
    expect(filledWearableOnlyFields(potion)).toEqual([]);
  });

  it("снятые свойства экипировки отсутствуют полем, а не занулены", () => {
    const stripped = withoutWearableOnlyFields(armored);
    expect("spellcastingFocus" in stripped).toBe(false);
  });

  it("экипировку и условие действия вещь называет сама", () => {
    expect(wearable(armored)).toBe(true);
    expect(wearable(potion)).toBe(false);
    expect(countedCarried({ ...potion, bonuses: { speed: 5 }, worksCarried: true })).toBe(true);
    expect(countedCarried(armored)).toBe(false);
  });
});

describe("объявление вещи", () => {
  it("прошедшая объявление вещь принимается молча", () => {
    expect(() => itemDefinitionOf(potion)).not.toThrow();
  });

  it("«зелье-фокусировка» отвергается, и отказ называет вещь", () => {
    expect(() => itemDefinitionOf({ ...potion, spellcastingFocus: true })).toThrow(DomainError);
  });

  it("правка прочь от экипировки снимает фокусировку и оставляет прибавку при себе", () => {
    const moved = alignedItemDefinition({
      id: "ring",
      nameRu: "Кольцо защиты",
      kinds: [],
      spellcastingFocus: true,
      bonuses: { armorClass: 1 },
    });
    expect(moved).toEqual({
      id: "ring",
      nameRu: "Кольцо защиты",
      kinds: [],
      notes: [],
      bonuses: { armorClass: 1 },
      worksCarried: true,
    });
  });

  it("прибавка из одних нулей не хранится: верёвка не участвует в счёте Класса Доспеха", () => {
    expect("bonuses" in itemDefinitionOf({ ...armored, bonuses: { armorClass: 0 } })).toBe(false);

    const contributing = itemDefinitionOf({
      ...armored,
      bonuses: { armorClass: 1, "save:wisdom": 0 },
    });
    expect(contributing.bonuses).toEqual({ armorClass: 1 });
  });

  it("пустой перечень прибавок — не прибавки: расходнику за него не отказывают", () => {
    const typed = itemDefinitionOf({ ...potion, bonuses: {} });
    expect("bonuses" in typed).toBe(false);
    expect(() => itemDefinitionOf({ ...potion, bonuses: { armorClass: 1 } })).toThrow(
      /при себе/,
    );
  });
});
