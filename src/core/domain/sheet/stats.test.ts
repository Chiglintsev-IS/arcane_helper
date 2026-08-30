import { describe, expect, it } from "vitest";

import type { StatContribution } from "@/core/domain/shared/stats";

import { resolveStats } from "./resolve";
import { statsOf, type StatFoundation } from "./stats";

const THORNE: StatFoundation = {
  level: 7,
  abilities: {
    strength: 8,
    dexterity: 14,
    constitution: 16,
    intelligence: 18,
    wisdom: 12,
    charisma: 8,
  },
  saveProficiencies: ["intelligence", "wisdom"],
  skills: {
    arcana: "proficient",
    investigation: "proficient",
    nature: "proficient",
    perception: "proficient",
  },
  speed: 30,
};

function resolved(...contributions: StatContribution[]) {
  const brought = contributions.map((contribution) => ({
    source: { origin: "effect", nameRu: "проба" },
    contribution,
  }));
  const stats = resolveStats(statsOf(THORNE), brought);
  return (id: Parameters<typeof stats.get>[0]) => stats.get(id)?.value;
}

describe("величины Торна", () => {
  it("без единого вклада числа складываются из одного основания", () => {
    const value = resolved();

    expect(value("proficiencyBonus")).toBe(3);
    expect(value("ability:intelligence")).toBe(18);
    expect(value("spellSaveDc")).toBe(15);
    expect(value("spellAttackModifier")).toBe(7);
    expect(value("preparedLimit")).toBe(11);
    expect(value("initiative")).toBe(1);
    expect(value("passivePerception")).toBe(14);
    expect(value("armorClass")).toBe(12);
    expect(value("speed")).toBe(30);
    expect(value("save:intelligence")).toBe(7);
    expect(value("save:strength")).toBe(-1);
    expect(value("skill:arcana")).toBe(7);
    expect(value("skill:acrobatics")).toBe(2);
  });
});

describe("вклад протекает по графу величин", () => {
  it("назначение на характеристику доходит до навыка, спасброска и чисел заклинателя", () => {
    const value = resolved({ stat: "ability:intelligence", kind: "assignment", value: 20 });

    expect(value("ability:intelligence")).toBe(20);
    expect(value("skill:arcana")).toBe(8);
    expect(value("save:intelligence")).toBe(8);
    expect(value("spellSaveDc")).toBe(16);
    expect(value("spellAttackModifier")).toBe(8);
    expect(value("preparedLimit")).toBe(12);
  });

  it("назначение бонуса мастерства доходит до КС и атаки заклинанием", () => {
    const value = resolved({ stat: "proficiencyBonus", kind: "assignment", value: 5 });

    expect(value("spellSaveDc")).toBe(17);
    expect(value("spellAttackModifier")).toBe(9);
    expect(value("save:intelligence")).toBe(9);
    expect(value("skill:arcana")).toBe(9);
    expect(value("passivePerception")).toBe(16);
  });

  it("прибавка к характеристике двигает всё, что из неё считают", () => {
    const value = resolved({ stat: "ability:dexterity", kind: "bonus", value: 2 });

    expect(value("ability:dexterity")).toBe(16);
    expect(value("armorClass")).toBe(13);
    expect(value("skill:stealth")).toBe(3);
  });

  it("характеристика не выходит за свой диапазон, и обрезанное значение действует дальше", () => {
    const value = resolved({ stat: "ability:strength", kind: "assignment", value: 99 });

    expect(value("ability:strength")).toBe(30);
    expect(value("skill:athletics")).toBe(10);
  });

  it("назначение на навык доходит до пассивной внимательности", () => {
    const value = resolved({ stat: "skill:perception", kind: "assignment", value: 9 });

    expect(value("passivePerception")).toBe(19);
  });
});

describe("Класс Доспеха считается той же свёрткой", () => {
  const mageArmor: StatContribution = {
    stat: "armorClass",
    kind: "method",
    method: { family: "spell", base: 13 },
  };
  const shield: StatContribution = { stat: "armorClass", kind: "bonus", value: 5 };

  it("без способа счёта защита считается от голого тела", () => {
    expect(resolved(shield)("armorClass")).toBe(17);
  });

  it("«Доспехи мага» задают базу вместо голого тела", () => {
    expect(resolved(mageArmor)("armorClass")).toBe(15);
  });

  it("«Щит» прибавляется поверх любого способа счёта", () => {
    expect(resolved(mageArmor, shield)("armorClass")).toBe(20);
  });

  it("два одинаковых способа не удваивают защиту: они спорят, а не складываются", () => {
    expect(resolved(mageArmor, mageArmor)("armorClass")).toBe(15);
  });

  it("назначение перекрывает и заклинание, и прибавку", () => {
    const assigned: StatContribution = { stat: "armorClass", kind: "assignment", value: 19 };

    expect(resolved(mageArmor, shield, assigned)("armorClass")).toBe(19);
  });
});
