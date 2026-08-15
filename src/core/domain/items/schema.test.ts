import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import {
  ITEMS_FIELDS,
  alignedItemDefinition,
  assertItemDefinition,
  filledGearOnlyFields,
  gearOnlyRefusal,
  itemDefinitionOf,
  withoutGearOnlyFields,
} from "@/core/domain/items/schema";
import type { ItemDefinition } from "@/core/domain/items/schema";

const potion: ItemDefinition = { id: "potion", nameRu: "Зелье", kind: "consumable" };
const armored: ItemDefinition = {
  id: "chainmail",
  nameRu: "Кольчуга",
  kind: "gear",
  armor: { base: 16, category: "heavy" },
  bonuses: { armorClass: 0 },
};

function withDefinition(item: unknown) {
  return ITEMS_FIELDS.itemDefinitions.safeParse([item]);
}

describe("подсхема вещи", () => {
  it("вещь без категории считается «другим»: находку не заставляют классифицировать", () => {
    const parsed = ITEMS_FIELDS.itemDefinitions.parse([{ id: "rope", nameRu: "Верёвка" }]);
    expect(parsed[0]?.kind).toBe("other");
  });

  it("категория вещи ограничена четырьмя: экипировка, расходник, ингредиент, другое", () => {
    for (const kind of ["gear", "consumable", "ingredient", "other"]) {
      expect(withDefinition({ id: "thing", nameRu: "Штука", kind }).success, kind).toBe(true);
    }
    expect(withDefinition({ id: "thing", nameRu: "Штука", kind: "potion" }).success).toBe(false);
  });

  it("цена вещи необязательна, а заданная проверяется монетой и целым числом", () => {
    const priced = (price: unknown) => withDefinition({ id: "thing", nameRu: "Штука", price });
    expect(withDefinition({ id: "thing", nameRu: "Штука" }).success).toBe(true);
    expect(priced({ amount: 50, currency: "gold" }).success).toBe(true);
    expect(priced({ amount: -1, currency: "gold" }).success).toBe(false);
    expect(priced({ amount: 50, currency: "рубль" }).success).toBe(false);
  });

  it("прибавки и база доспеха бывают только у экипировки (FR-238)", () => {
    const bonuses = { armorClass: 1 };
    const armor = { base: 16, category: "heavy" };
    expect(withDefinition({ ...potion, bonuses }).success).toBe(false);
    expect(withDefinition({ ...potion, armor }).success).toBe(false);
    // Та же запись экипировкой проходит: запрещено не поле, а его несовместимость с категорией.
    expect(withDefinition({ ...potion, kind: "gear", bonuses, armor }).success).toBe(true);
  });

  it("отметка фокусировки бывает только у экипировки (FR-260)", () => {
    const spellcastingFocus = true;
    expect(withDefinition({ ...potion, spellcastingFocus }).success).toBe(false);
    // Та же отметка у экипировки проходит: магию проводят тем, что носят.
    expect(withDefinition({ ...potion, kind: "gear", spellcastingFocus }).success).toBe(true);
    // Отметка утвердительная: хранимое «нет» было бы вторым способом сказать «не фокусировка».
    expect(withDefinition({ ...potion, kind: "gear", spellcastingFocus: false }).success).toBe(
      false,
    );
  });

  it("прибавка называет величину словаря, и выдуманной величины не бывает (FR-247)", () => {
    const gear = { id: "ring", nameRu: "Кольцо", kind: "gear" };
    expect(withDefinition({ ...gear, bonuses: { "save:wisdom": 1 } }).success).toBe(true);
    expect(withDefinition({ ...gear, bonuses: { savingThrows: 1 } }).success).toBe(false);
    expect(withDefinition({ ...gear, bonuses: { armorClass: 1.5 } }).success).toBe(false);
  });

  it("категория доспеха необязательна и ограничена тремя (FR-247)", () => {
    const gear = { id: "mail", nameRu: "Кольчуга", kind: "gear" };
    expect(withDefinition({ ...gear, armor: { base: 16 } }).success).toBe(true);
    expect(withDefinition({ ...gear, armor: { base: 16, category: "light" } }).success).toBe(true);
    expect(withDefinition({ ...gear, armor: { base: 16, category: "plate" } }).success).toBe(false);
    expect(withDefinition({ ...gear, armor: { base: 0 } }).success).toBe(false);
  });

  it("отказ называет вещь по имени", () => {
    expect(gearOnlyRefusal("Зелье")).toContain("Зелье");
    expect(gearOnlyRefusal("Зелье")).toContain("не экипировка");
  });
});

describe("свойства экипировки: перечисление, снятие", () => {
  it("заполненные свойства экипировки перечисляются", () => {
    expect(filledGearOnlyFields(armored)).toEqual(["bonuses", "armor"]);
    expect(filledGearOnlyFields(potion)).toEqual([]);
  });

  it("снятые свойства экипировки отсутствуют полем, а не занулены", () => {
    const stripped = withoutGearOnlyFields(armored);
    expect("bonuses" in stripped).toBe(false);
    expect("armor" in stripped).toBe(false);
  });
});

describe("assertItemDefinition и alignedItemDefinition", () => {
  it("прошедшая объявление вещь принимается молча", () => {
    expect(() => assertItemDefinition(potion)).not.toThrow();
  });

  it("«надетое зелье с прибавкой» отвергается, и отказ называет вещь (FR-238)", () => {
    expect(() => assertItemDefinition({ ...potion, bonuses: { armorClass: 1 } })).toThrow(
      DomainError,
    );
  });

  it("правка со сменой категории на не-экипировку снимает свойства экипировки, а не отвергает", () => {
    const moved = alignedItemDefinition({ ...potion, kind: "other" });
    expect(moved).toEqual({ id: "potion", nameRu: "Зелье", kind: "other" });
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
    // Шторка вещи отдаёт набранное как есть, и «ничего не набрано» приезжает пустым перечнем.
    // Отказ на нём говорил бы про прибавки тому, кто их не набирал.
    const typed = itemDefinitionOf({ ...potion, kind: "other", bonuses: {} });
    expect("bonuses" in typed).toBe(false);
    expect(() => itemDefinitionOf({ ...potion, bonuses: { armorClass: 1 } })).toThrow(
      /не экипировка/,
    );
  });
});
