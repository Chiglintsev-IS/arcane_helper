import { describe, expect, it } from "vitest";

import { equipmentSchema } from "@/core/domain/equipment/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

/**
 * Пределы и словари снаряжения на самом снаряжении: собирать ради них целого персонажа значило бы
 * проверять заодно и его правила.
 */
function withItem(item: unknown) {
  return equipmentSchema.safeParse({ items: [item] });
}

describe("подсхема снаряжения", () => {
  it("принимает снаряжение Торна", () => {
    const parsed = equipmentSchema.safeParse(createThorne().equipment);
    expect(parsed.success).toBe(true);
  });

  it("вещь без количества считается одной штукой: старое сохранение не лжёт о запасах", () => {
    const parsed = equipmentSchema.parse({ items: [{ id: "rope", nameRu: "Верёвка" }] });
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
    expect(equipmentSchema.parse({ items: [] }).money).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(
      equipmentSchema.safeParse({ items: [], money: { gold: -1, silver: 0, copper: 0 } }).success,
    ).toBe(false);
  });

  it("база КД доспеха выводится из надетого, а не хранится у персонажа", () => {
    const parsed = equipmentSchema.parse({
      items: [{ id: "chain-mail", nameRu: "Кольчуга", worn: true, armorBase: 16 }],
    });
    expect(parsed.items[0]?.armorBase).toBe(16);
  });
});
