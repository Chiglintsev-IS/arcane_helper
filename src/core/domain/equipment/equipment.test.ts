import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

const ring: ItemDefinition = {
  id: "ring",
  nameRu: "Кольцо защиты",
  kind: "gear",
  bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
};

const potion: ItemDefinition = { id: "healing-potion", nameRu: "Зелье лечения", kind: "consumable" };

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kind: "other" };

const helmet: ItemDefinition = { id: "helmet", nameRu: "Шлем", kind: "gear" };

const chainmail: ItemDefinition = {
  id: "chainmail",
  nameRu: "Кольчуга",
  kind: "gear",
  armorBase: 16,
};

const leather: ItemDefinition = {
  id: "leather",
  nameRu: "Кожаный доспех",
  kind: "gear",
  armorBase: 11,
};

const gear = () => Equipment.of(createThorne());
const items = (...definitions: ItemDefinition[]) => Items.of({ itemDefinitions: definitions });

describe("снаряжение", () => {
  it("прибавка считается только из надетых вещей", () => {
    // Вещи Торна: фокусировка +1 к магии, мантия +1 и плащ +1 к защите, плащ +1 к спасброскам.
    const thorne = createThorne();
    expect(Equipment.of(thorne).bonuses(Items.of(thorne))).toEqual({
      spellcasting: 1,
      armorClass: 2,
      savingThrows: 1,
    });

    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));
    expect(worn.bonuses(items(ring)).armorClass).toBe(1);
    expect(worn.bonuses(items(ring)).savingThrows).toBe(1);
  });

  it("лежащее в сумке к числам не прибавляется", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    expect(stocked.bonuses(items(ring))).toEqual(gear().bonuses(items(ring)));
  });

  it("вещь без прибавки на числа не влияет", () => {
    const stocked = gear().adjustBagCount("helmet", 1).equip("helmet", 1, items(helmet));
    expect(stocked.bonuses(items(helmet))).toEqual(gear().bonuses(items(helmet)));
  });

  it("надевание переносит счёт из сумки в надетое", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    const worn = stocked.equip("ring", 1, items(ring));
    expect(worn.bagCount("ring")).toBe(0);
    expect(worn.wornCount("ring")).toBe(1);
    expect(worn.bonuses(items(ring)).armorClass).toBe(gear().bonuses(items(ring)).armorClass + 1);
  });

  it("снятие переносит счёт обратно в сумку", () => {
    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));
    const unworn = worn.unequip("ring", 1);
    expect(unworn.bagCount("ring")).toBe(1);
    expect(unworn.wornCount("ring")).toBe(0);
  });

  it("надевается только экипировка (FR-238)", () => {
    const stocked = gear().adjustBagCount("healing-potion", 1);
    expect(() => stocked.equip("healing-potion", 1, items(potion))).toThrow(DomainError);
  });

  it("надеть больше, чем есть в сумке, нельзя", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    expect(() => stocked.equip("ring", 2, items(ring))).toThrow(DomainError);
  });

  it("снять больше, чем надето, нельзя", () => {
    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));
    expect(() => worn.unequip("ring", 2)).toThrow(DomainError);
  });

  it("надеть незаведённую вещь нельзя", () => {
    expect(() => gear().equip("ring", 1, items())).toThrow(DomainError);
  });

  it("запас в сумке меняется приращением в обе стороны", () => {
    const stocked = gear().adjustBagCount("healing-potion", 3);
    expect(stocked.bagCount("healing-potion")).toBe(3);
    expect(stocked.adjustBagCount("healing-potion", -1).bagCount("healing-potion")).toBe(2);
    expect(stocked.adjustBagCount("healing-potion", 4).bagCount("healing-potion")).toBe(7);
  });

  it("ноль — состояние: кончившийся расходник остаётся в сумке нулём", () => {
    const empty = gear().adjustBagCount("healing-potion", 1).adjustBagCount("healing-potion", -1);
    expect(empty.bagCount("healing-potion")).toBe(0);
  });

  it("ниже нуля и выше предела запас не уходит, нулевое и дробное приращение отвергается", () => {
    const stocked = gear().adjustBagCount("healing-potion", 1);
    expect(() => stocked.adjustBagCount("healing-potion", -2)).toThrow(DomainError);
    expect(() => stocked.adjustBagCount("healing-potion", 9999)).toThrow(DomainError);
    expect(() => stocked.adjustBagCount("healing-potion", 0)).toThrow(DomainError);
    expect(() => stocked.adjustBagCount("healing-potion", 0.5)).toThrow(DomainError);
  });

  it("кошелёк меняется целиком и читается обратно", () => {
    const paid = gear().withMoney({ gold: 215, silver: 30, copper: 12 });
    expect(paid.money.gold).toBe(215);
    expect(gear().money.gold).toBe(0);
  });

  it("база КД выводится из надетого: без доспеха 10, надетый доспех задаёт свою", () => {
    expect(gear().armorClassBase(items())).toBe(10);
    expect(gear().wornArmor(items())).toBeUndefined();

    const armored = gear().adjustBagCount("chainmail", 1).equip("chainmail", 1, items(chainmail));
    expect(armored.armorClassBase(items(chainmail))).toBe(16);
    expect(armored.wornArmor(items(chainmail))?.nameRu).toBe("Кольчуга");
  });

  it("из двух надетых доспехов действует наибольшая база — замены не складываются", () => {
    const both = items(chainmail, leather);
    const wornBoth = gear()
      .adjustBagCount("chainmail", 1)
      .adjustBagCount("leather", 1)
      .equip("chainmail", 1, both)
      .equip("leather", 1, both);
    expect(wornBoth.armorClassBase(both)).toBe(16);
  });

  it("доспех в сумке базы не задаёт: кольчуга защищает надетой", () => {
    const carried = gear().adjustBagCount("chainmail", 1);
    expect(carried.armorClassBase(items(chainmail))).toBe(10);
  });

  it("отсутствие вещи в сумке или на теле отвергается с причиной", () => {
    expect(() => gear().equip("rope", 1, items(rope))).toThrow(DomainError);
    expect(() => gear().unequip("ring", 1)).toThrow(DomainError);
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

