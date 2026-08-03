import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Equipment } from "@/core/domain/equipment/equipment";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { InventoryItem } from "@/core/domain/character/state";

const ring = (worn: boolean): InventoryItem => ({
  id: "ring",
  nameRu: "Кольцо защиты",
  kind: "gear",
  worn,
  count: 1,
  bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
});

const potions = (count: number): InventoryItem => ({
  id: "healing-potion",
  nameRu: "Зелье лечения",
  kind: "consumable",
  worn: false,
  count,
});

const rope: InventoryItem = { id: "rope", nameRu: "Верёвка", kind: "other", worn: false, count: 1 };

const gear = () => Equipment.of(createThorne());

describe("снаряжение", () => {
  it("прибавка считается только из надетых вещей", () => {
    // Вещи Торна: фокусировка +1 к магии, мантия +1 и плащ +1 к защите, плащ +1 к спасброскам.
    expect(gear().bonuses).toEqual({ spellcasting: 1, armorClass: 2, savingThrows: 1 });

    const worn = gear().addItem(ring(true));
    expect(worn.bonuses).toEqual({ spellcasting: 1, armorClass: 3, savingThrows: 2 });
  });

  it("лежащее в сумке к числам не прибавляется", () => {
    expect(gear().addItem(ring(false)).bonuses).toEqual(gear().bonuses);
  });

  it("вещь без прибавки на числа не влияет", () => {
    expect(gear().addItem({ ...rope, worn: true }).bonuses).toEqual(gear().bonuses);
  });

  it("прибавка не экипировки не считается даже надетой: порченые данные не двигают числа", () => {
    const strange = gear().addItem({ ...potions(1), worn: true, bonuses: { spellcasting: 0, armorClass: 5, savingThrows: 0 } });
    expect(strange.bonuses).toEqual(gear().bonuses);
  });

  it("надевание и снятие переключают вклад", () => {
    const carried = gear().addItem(ring(false));
    expect(carried.toggleWorn("ring").bonuses.armorClass).toBe(3);
    expect(carried.toggleWorn("ring").toggleWorn("ring").bonuses.armorClass).toBe(2);
  });

  it("надевается только экипировка", () => {
    const stocked = gear().addItem(potions(1));
    expect(() => stocked.toggleWorn("healing-potion")).toThrow(DomainError);
  });

  it("вещь правится и убирается", () => {
    const worn = gear().addItem(ring(true));
    const renamed = worn.replaceItem({ ...ring(true), nameRu: "Кольцо защиты +1" });

    expect(renamed.items.find((item) => item.id === "ring")?.nameRu).toBe("Кольцо защиты +1");
    expect(worn.removeItem("ring").items.some((item) => item.id === "ring")).toBe(false);
  });

  it("правка одной вещи соседних не трогает", () => {
    const two = gear().addItem(ring(true)).addItem(rope);
    const renamed = two.replaceItem({ ...ring(true), nameRu: "Кольцо защиты +1" });

    expect(renamed.items.map((item) => item.nameRu)).toEqual([
      ...gear().items.map((item) => item.nameRu),
      "Кольцо защиты +1",
      "Верёвка",
    ]);
  });

  it("одноимённая вещь той же категории пополняет запас, а не отвергается", () => {
    const stacked = gear().addItem(potions(2)).addItem(potions(3));

    expect(stacked.items.filter((item) => item.id === "healing-potion")).toHaveLength(1);
    expect(stacked.items.find((item) => item.id === "healing-potion")?.count).toBe(5);
  });

  it("одноимённая вещь другой категории отвергается с причиной (FR-241)", () => {
    const stocked = gear().addItem(rope);
    expect(() => stocked.addItem({ ...rope, kind: "gear" })).toThrow(/другой категорией/);
  });

  it("пополнение через находку не пробивает предел запаса (FR-238)", () => {
    const full = gear().addItem(potions(9999));
    expect(() => full.addItem(potions(1))).toThrow(DomainError);
    // Нулевое пополнение одноимённой вещи ничего не меняет и не отвергается.
    expect(full.addItem(potions(0)).items.find((item) => item.id === "healing-potion")?.count).toBe(9999);
  });

  it("отсутствие вещи и порча данных отвергаются с причиной", () => {
    expect(() => gear().replaceItem(ring(true))).toThrow(DomainError);
    expect(() => gear().removeItem("ring")).toThrow(DomainError);
    expect(() => gear().toggleWorn("ring")).toThrow(DomainError);
    expect(() => gear().adjustCount("ring", -1)).toThrow(DomainError);
  });

  it("запас меняется приращением в обе стороны", () => {
    const stocked = gear().addItem(potions(3));
    expect(stocked.adjustCount("healing-potion", -1).items.find((item) => item.id === "healing-potion")?.count).toBe(2);
    expect(stocked.adjustCount("healing-potion", 4).items.find((item) => item.id === "healing-potion")?.count).toBe(7);
  });

  it("ноль — состояние: кончившийся расходник остаётся в сумке нулём", () => {
    const empty = gear().addItem(potions(1)).adjustCount("healing-potion", -1);
    expect(empty.items.find((item) => item.id === "healing-potion")?.count).toBe(0);
  });

  it("ниже нуля и выше предела запас не уходит, нулевое и дробное приращение отвергается", () => {
    const stocked = gear().addItem(potions(1));
    expect(() => stocked.adjustCount("healing-potion", -2)).toThrow(DomainError);
    expect(() => stocked.adjustCount("healing-potion", 9999)).toThrow(DomainError);
    expect(() => stocked.adjustCount("healing-potion", 0)).toThrow(DomainError);
    expect(() => stocked.adjustCount("healing-potion", 0.5)).toThrow(DomainError);
  });

  it("кошелёк меняется целиком и читается обратно", () => {
    const paid = gear().withMoney({ gold: 215, silver: 30, copper: 12 });
    expect(paid.money.gold).toBe(215);
    expect(gear().money.gold).toBe(0);
  });

  it("база Класса Доспеха правится и проверяется", () => {
    expect(gear().withArmorClassBase(15).armorClassBase).toBe(15);
    expect(() => gear().withArmorClassBase(0)).toThrow(DomainError);
    expect(() => gear().withArmorClassBase(1.5)).toThrow(DomainError);
  });

  it("отсутствие записи о компонентах — не пустая сумка, а незнание", () => {
    const base = createThorne();
    const { components: _none, ...withoutComponents } = base.equipment;

    expect(gear().known).toBe(true);
    expect(Equipment.of({ ...base, equipment: withoutComponents }).known).toBe(false);
    expect(Equipment.of({ ...base, equipment: withoutComponents }).replacesFreeComponents).toBe(
      false,
    );
    expect(() =>
      Equipment.of({ ...base, equipment: withoutComponents }).toggleMaterial("identify"),
    ).toThrow(DomainError);
  });

  it("фокусировка заменяет компоненты без стоимости, дорогой ищется поимённо", () => {
    expect(gear().replacesFreeComponents).toBe(true);
    expect(gear().hasMaterialFor("identify")).toBe(false);

    const bought = gear().toggleMaterial("identify");
    expect(bought.owned).toBe(true);
    expect(bought.equipment.hasMaterialFor("identify")).toBe(true);
    expect(bought.equipment.toggleMaterial("identify").owned).toBe(false);
  });
});
