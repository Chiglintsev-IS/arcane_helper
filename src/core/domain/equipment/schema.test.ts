import { describe, expect, it } from "vitest";

import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { DomainError } from "@/core/domain/shared/errors";
import { assertMoney, assertStockEntry } from "@/core/domain/equipment/schema";

function withStock(entry: unknown) {
  return EQUIPMENT_FIELDS.equipment.safeParse({ bag: [entry] });
}

describe("подсхема снаряжения", () => {
  it("принимает снаряжение Торна", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.safeParse(createThorne().equipment);
    expect(parsed.success).toBe(true);
  });

  it("запись запаса без счёта считается одной штукой: старое сохранение не лжёт о запасах", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.parse({ bag: [{ itemId: "rope" }] });
    expect(parsed.bag[0]?.count).toBe(1);
  });

  it("счёт запаса — от нуля до предела: ноль хранится, отрицательное и перебор отвергаются", () => {
    const entry = (count: number) => ({ itemId: "healing-potion", count });
    expect(withStock(entry(0)).success).toBe(true);
    expect(withStock(entry(-1)).success).toBe(false);
    expect(withStock(entry(9999)).success).toBe(true);
    expect(withStock(entry(10000)).success).toBe(false);
  });

  it("сумка и надетое по умолчанию пусты", () => {
    const parsed = EQUIPMENT_FIELDS.equipment.parse({});
    expect(parsed.bag).toEqual([]);
    expect(parsed.worn).toEqual([]);
  });

  it("кошелёк по умолчанию пуст, отрицательная монета отвергается", () => {
    expect(EQUIPMENT_FIELDS.equipment.parse({}).money).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(
      EQUIPMENT_FIELDS.equipment.safeParse({ money: { gold: -1, silver: 0, copper: 0 } }).success,
    ).toBe(false);
  });
});

describe("правка запаса и кошелька проходит объявления", () => {
  const reason = (attempt: () => unknown): string => {
    try {
      attempt();
    } catch (error: unknown) {
      return error instanceof DomainError ? error.message : String(error);
    }
    throw new Error("правка принята, а ожидался отказ");
  };

  it("отрицательный счёт запаса не сохраняется", () => {
    expect(reason(() => assertStockEntry({ itemId: "rope", count: -1 }))).toContain("count");
  });

  it("отрицательная монета не сохраняется, и причина звучит по-русски целиком", () => {
    expect(reason(() => assertMoney({ gold: -1, silver: 0, copper: 0 }))).toBe(
      "Не годится кошелёк — поле «gold»: Слишком маленькое значение: ожидалось, что число будет >=0",
    );
  });

  it("причина дробного отказа звучит по-русски целиком, без слова библиотеки внутри фразы", () => {
    expect(reason(() => assertMoney({ gold: 12.5, silver: 0, copper: 0 }))).toBe(
      "Не годится кошелёк — поле «gold»: Неверный ввод: ожидалось целое число, получено число",
    );
  });

  it("прошедшее объявления принимается молча", () => {
    expect(() => assertStockEntry({ itemId: "rope", count: 1 })).not.toThrow();
    expect(() => assertMoney({ gold: 15, silver: 3, copper: 0 })).not.toThrow();
  });
});

