import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import {
  ITEMS_FIELDS,
  alignedItemDefinition,
  assertItemDefinition,
  filledGearOnlyFields,
  gearOnlyRefusal,
  withoutEmptyBonuses,
  withoutGearOnlyFields,
} from "@/core/domain/items/schema";
import type { ItemDefinition } from "@/core/domain/items/schema";

const potion = { id: "potion", nameRu: "Зелье", kind: "consumable" as const };
const armored: ItemDefinition = {
  id: "chainmail",
  nameRu: "Кольчуга",
  kind: "gear",
  armorBase: 16,
  bonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
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
    const bonuses = { spellcasting: 0, armorClass: 1, savingThrows: 0 };
    expect(withDefinition({ ...potion, bonuses }).success).toBe(false);
    expect(withDefinition({ ...potion, armorBase: 16 }).success).toBe(false);
    // Та же запись экипировкой проходит: запрещено не поле, а его несовместимость с категорией.
    expect(withDefinition({ ...potion, kind: "gear", bonuses, armorBase: 16 }).success).toBe(true);
  });

  it("отказ называет вещь по имени", () => {
    expect(gearOnlyRefusal("Зелье")).toContain("Зелье");
    expect(gearOnlyRefusal("Зелье")).toContain("не экипировка");
  });
});

describe("свойства экипировки: перечисление, снятие", () => {
  it("заполненные свойства экипировки перечисляются", () => {
    expect(filledGearOnlyFields(armored)).toEqual(["bonuses", "armorBase"]);
    expect(filledGearOnlyFields(potion)).toEqual([]);
  });

  it("снятые свойства экипировки отсутствуют полем, а не занулены", () => {
    const stripped = withoutGearOnlyFields(armored);
    expect("bonuses" in stripped).toBe(false);
    expect("armorBase" in stripped).toBe(false);
  });
});

describe("assertItemDefinition и alignedItemDefinition", () => {
  it("прошедшая объявление вещь принимается молча", () => {
    expect(() => assertItemDefinition(potion)).not.toThrow();
  });

  it("«надетое зелье с прибавкой» отвергается, и отказ называет вещь (FR-238)", () => {
    expect(() =>
      assertItemDefinition({ ...potion, bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 } }),
    ).toThrow(DomainError);
  });

  it("правка со сменой категории на не-экипировку снимает свойства экипировки, а не отвергает", () => {
    const moved = alignedItemDefinition({ ...(potion as ItemDefinition), kind: "other" });
    expect(moved).toEqual({ id: "potion", nameRu: "Зелье", kind: "other" });
  });

  it("прибавка из одних нулей не хранится: верёвка не участвует в счёте Класса Доспеха", () => {
    const zeroed = withoutEmptyBonuses({
      ...armored,
      bonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    });
    expect("bonuses" in zeroed).toBe(false);

    const contributing = withoutEmptyBonuses({
      ...armored,
      bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
    });
    expect(contributing.bonuses).toEqual({ spellcasting: 0, armorClass: 1, savingThrows: 0 });
  });
});
