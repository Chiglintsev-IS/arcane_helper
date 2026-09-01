import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";
import type { SourcedContribution, StatId } from "@/core/domain/shared/stats";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withoutSpellcastingFocus } from "@/core/infrastructure/catalog/thorne/fixtures";

function bonusFor(brought: readonly SourcedContribution[], stat: StatId): number {
  return brought.reduce(
    (sum, { contribution }) =>
      contribution.stat === stat && contribution.kind === "bonus" ? sum + contribution.value : sum,
    0,
  );
}

function armorMethods(brought: readonly SourcedContribution[]) {
  return brought.flatMap(({ source, contribution }) =>
    contribution.kind === "method"
      ? [{ nameRu: source.nameRu, base: contribution.method.base }]
      : [],
  );
}

const ring: ItemDefinition = {
  id: "ring",
  nameRu: "Кольцо защиты",
  kinds: ["gear"],
  bonuses: { armorClass: 1, "save:wisdom": 1 },
};

const potion: ItemDefinition = { id: "healing-potion", nameRu: "Зелье лечения", kinds: ["consumable"] };

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kinds: [] };

const helmet: ItemDefinition = { id: "helmet", nameRu: "Шлем", kinds: ["gear"] };

const stone: ItemDefinition = {
  id: "stone",
  nameRu: "Камень удачи",
  kinds: [],
  bonuses: { initiative: 1 },
  worksCarried: true,
};

const chainmail: ItemDefinition = {
  id: "chainmail",
  nameRu: "Кольчуга",
  kinds: ["gear"],
  bonuses: { armorClass: 2 },
};

const gear = () => Equipment.of(createThorne());
const items = (...definitions: ItemDefinition[]) => Items.of({ itemDefinitions: definitions });

describe("снаряжение", () => {
  it("вклад приходит только от надетых вещей", () => {
    const thorne = createThorne();
    const brought = Equipment.of(thorne).contributions(Items.of(thorne));

    expect(bonusFor(brought, "armorClass")).toBe(2);
    expect(bonusFor(brought, "spellSaveDc")).toBe(1);
    expect(bonusFor(brought, "spellAttackModifier")).toBe(1);
    expect(bonusFor(brought, "save:wisdom")).toBe(1);
  });

  it("каждый вклад приходит с вещью, которая его принесла", () => {
    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));

    expect(worn.contributions(items(ring))).toContainEqual({
      source: { origin: "item", nameRu: "Кольцо защиты" },
      contribution: { stat: "armorClass", kind: "bonus", value: 1 },
    });
  });

  it("снятое кольцо вклада не даёт", () => {
    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));
    const taken = worn.unequip("ring", 1);

    expect(bonusFor(worn.contributions(items(ring)), "armorClass")).toBe(1);
    expect(bonusFor(taken.contributions(items(ring)), "armorClass")).toBe(0);
  });

  it("запас ставится числом сразу, а не по одной штуке", () => {
    const counted = gear().setBagCount("ring", 32);
    expect(counted.bagCount("ring")).toBe(32);
    expect(counted.setBagCount("ring", 0).bagCount("ring")).toBe(0);
  });

  it("запас числом не бывает отрицательным, дробным и запредельным", () => {
    expect(() => gear().setBagCount("ring", -1)).toThrow(DomainError);
    expect(() => gear().setBagCount("ring", 1.5)).toThrow(/целое от нуля/);
    expect(() => gear().setBagCount("ring", 1_000_000)).toThrow(/не хранится/);
  });

  it("лежащее в сумке вклада не приносит", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    expect(stocked.contributions(items(ring))).toEqual(gear().contributions(items(ring)));
  });

  it("прибавка «при себе» приходит из сумки, а без запаса не приходит", () => {
    const carried = gear().adjustBagCount("stone", 1);
    expect(bonusFor(carried.contributions(items(stone)), "initiative")).toBe(1);
    expect(bonusFor(gear().contributions(items(stone)), "initiative")).toBe(0);
  });

  it("вещь без прибавки вклада не приносит", () => {
    const stocked = gear().adjustBagCount("helmet", 1).equip("helmet", 1, items(helmet));
    expect(stocked.contributions(items(helmet))).toEqual(gear().contributions(items(helmet)));
  });

  it("надевание переносит счёт из сумки в надетое", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    const worn = stocked.equip("ring", 1, items(ring));
    expect(worn.bagCount("ring")).toBe(0);
    expect(worn.wornCount("ring")).toBe(1);
    expect(bonusFor(worn.contributions(items(ring)), "armorClass")).toBe(
      bonusFor(gear().contributions(items(ring)), "armorClass") + 1,
    );
  });

  it("снятие переносит счёт обратно в сумку", () => {
    const worn = gear().adjustBagCount("ring", 1).equip("ring", 1, items(ring));
    const unworn = worn.unequip("ring", 1);
    expect(unworn.bagCount("ring")).toBe(1);
    expect(unworn.wornCount("ring")).toBe(0);
  });

  it("надевается только экипировка", () => {
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

  it("число вещи для надевания и снятия — целое и положительное", () => {
    const stocked = gear().adjustBagCount("ring", 1);
    expect(() => stocked.equip("ring", 0, items(ring))).toThrow(DomainError);
    expect(() => stocked.equip("ring", 1.5, items(ring))).toThrow(DomainError);

    const worn = stocked.equip("ring", 1, items(ring));
    expect(() => worn.unequip("ring", 0)).toThrow(DomainError);
    expect(() => worn.unequip("ring", 1.5)).toThrow(DomainError);
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

  it("вещь способов счёта не приносит: защиту вещи двигают прибавкой", () => {
    const armored = gear().adjustBagCount("chainmail", 1).equip("chainmail", 1, items(chainmail));

    expect(armorMethods(armored.contributions(items(chainmail)))).toEqual([]);
    expect(bonusFor(armored.contributions(items(chainmail)), "armorClass")).toBe(2);
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
  });

  it("надетая фокусировка закрывает компоненты без стоимости, лежащая в сумке — нет", () => {
    const thorne = createThorne();
    expect(Equipment.of(thorne).replacesFreeComponents(Items.of(thorne))).toBe(true);

    const stowed = withoutSpellcastingFocus(thorne);
    expect(Equipment.of(stowed).replacesFreeComponents(Items.of(stowed))).toBe(false);
  });

  it("мешочек закрывает компоненты и без фокусировки", () => {
    const stowed = withoutSpellcastingFocus(createThorne());
    const components = { componentPouch: true };
    const pouch = Equipment.of({ ...stowed, equipment: { ...stowed.equipment, components } });

    expect(pouch.replacesFreeComponents(Items.of(stowed))).toBe(true);
  });

  it("желание купить ставится и снимается, а повтор ничего не меняет", () => {
    const wishing = gear().withWanted("rope", true);
    expect(wishing.wants("rope")).toBe(true);
    expect(wishing.withWanted("rope", true)).toBe(wishing);
    expect(wishing.withWanted("rope", false).wants("rope")).toBe(false);
    expect(gear().wants("rope")).toBe(false);
  });

  it("вещь есть у того, у кого она в сумке: ноль — не наличие", () => {
    expect(gear().carries("rope")).toBe(false);

    const bought = gear().adjustBagCount("rope", 1);
    expect(bought.carries("rope")).toBe(true);
    expect(bought.adjustBagCount("rope", -1).carries("rope")).toBe(false);
  });
});

