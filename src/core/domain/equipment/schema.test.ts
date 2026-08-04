import { describe, expect, it } from "vitest";

import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { DomainError } from "@/core/domain/shared/errors";
import { assertInventoryItem, assertMoney } from "@/core/domain/equipment/schema";

/**
 * Пределы и словари снаряжения на самом снаряжении: собирать ради них целого персонажа значило бы
 * проверять заодно и его правила.
 */
function withItem(item: unknown) {
  return EQUIPMENT_FIELDS.equipment.safeParse({ items: [item] });
}

describe("подсхема снаряжения", () => {
  it("принимает снаряжение Торна", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.safeParse(createThorne().equipment);
    expect(parsed.success).toBe(true);
  });

  it("вещь без количества считается одной штукой: старое сохранение не лжёт о запасах", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.parse({ items: [{ id: "rope", nameRu: "Верёвка" }] });
    expect(parsed.items[0]?.count).toBe(1);
    expect(parsed.items[0]?.kind).toBe("other");
    expect(parsed.items[0]?.worn).toBe(false);
  });

  it("счёт вещи — от нуля до предела: ноль хранится, отрицательное и перебор отвергаются", () => {
    const item = (count: number) => ({ id: "healing-potion", nameRu: "Зелье лечения", count });
    expect(withItem(item(0)).success).toBe(true);
    expect(withItem(item(-1)).success).toBe(false);
    expect(withItem(item(9999)).success).toBe(true);
    expect(withItem(item(10000)).success).toBe(false);
  });

  it("категория вещи ограничена четырьмя: экипировка, расходник, ингредиент, другое", () => {
    for (const kind of ["gear", "consumable", "ingredient", "other"]) {
      expect(withItem({ id: "thing", nameRu: "Штука", kind }).success, kind).toBe(true);
    }
    // Прежние рода в живом состоянии не хранятся: их переводит приведение, а не схема.
    expect(withItem({ id: "thing", nameRu: "Штука", kind: "potion" }).success).toBe(false);
  });

  it("цена вещи необязательна, а заданная проверяется монетой и целым числом", () => {
    const priced = (price: unknown) => withItem({ id: "thing", nameRu: "Штука", price });
    expect(withItem({ id: "thing", nameRu: "Штука" }).success).toBe(true);
    expect(priced({ amount: 50, currency: "gold" }).success).toBe(true);
    expect(priced({ amount: -1, currency: "gold" }).success).toBe(false);
    expect(priced({ amount: 50, currency: "рубль" }).success).toBe(false);
  });

  it("кошелёк по умолчанию пуст, отрицательная монета отвергается", () => {
    expect(EQUIPMENT_FIELDS.equipment.parse({ items: [] }).money).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(
      EQUIPMENT_FIELDS.equipment.safeParse({ items: [], money: { gold: -1, silver: 0, copper: 0 } }).success,
    ).toBe(false);
  });

  it("база КД доспеха выводится из надетого, а не хранится у персонажа", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.parse({
      items: [{ id: "chain-mail", nameRu: "Кольчуга", kind: "gear", worn: true, armorBase: 16 }],
    });
    expect(parsed.items[0]?.armorBase).toBe(16);
  });

  it("надетость, прибавки и база доспеха бывают только у экипировки (FR-238)", () => {
    const potion = { id: "potion", nameRu: "Зелье", kind: "consumable" };
    const bonuses = { spellcasting: 0, armorClass: 1, savingThrows: 0 };
    expect(withItem({ ...potion, worn: true }).success).toBe(false);
    expect(withItem({ ...potion, bonuses }).success).toBe(false);
    expect(withItem({ ...potion, armorBase: 16 }).success).toBe(false);
    expect(withItem({ ...potion, worn: false }).success).toBe(true);
    // Та же запись экипировкой проходит: запрещено не поле, а его несовместимость с категорией.
    expect(withItem({ ...potion, kind: "gear", worn: true, bonuses, armorBase: 16 }).success).toBe(true);
  });
});

describe("правка вещи и кошелька проходит объявления", () => {
  const reason = (attempt: () => unknown): string => {
    try {
      attempt();
    } catch (error: unknown) {
      return error instanceof DomainError ? error.message : String(error);
    }
    throw new Error("правка принята, а ожидался отказ");
  };

  const potion = { id: "potion", nameRu: "Зелье", kind: "consumable", worn: false, count: 1 };

  it("дробная цена не сохраняется", () => {
    expect(reason(() => assertInventoryItem({ ...potion, price: { amount: 1.5, currency: "gold" } })))
      .toContain("price");
  });

  it("отрицательная монета не сохраняется", () => {
    expect(reason(() => assertMoney({ gold: -1, silver: 0, copper: 0 }))).toContain("gold");
  });

  it("дробная прибавка экипировки не сохраняется", () => {
    expect(
      reason(() =>
        assertInventoryItem({
          ...potion,
          kind: "gear",
          bonuses: { spellcasting: 0.5, armorClass: 0, savingThrows: 0 },
        }),
      ),
    ).toContain("bonuses");
  });

  it("«надетое зелье» не сохраняется, и отказ называет вещь (FR-238)", () => {
    const refused = reason(() => assertInventoryItem({ ...potion, worn: true }));
    expect(refused).toContain("Зелье");
    expect(refused).toContain("не экипировка");
  });

  it("прошедшее объявления принимается молча", () => {
    expect(() => assertInventoryItem(potion)).not.toThrow();
    expect(() => assertMoney({ gold: 15, silver: 3, copper: 0 })).not.toThrow();
  });
});
