import { describe, expect, it } from "vitest";

import {
  ABILITIES,
  SKILL_IDS,
  STAT_IDS,
  abilityStatId,
  isStatId,
  saveStatId,
  skillStatId,
  statContributionSchema,
} from "./stats";

describe("словарь величин", () => {
  it("шесть характеристик в порядке листа персонажа", () => {
    expect(ABILITIES).toEqual([
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);
  });

  it("восемнадцать навыков", () => {
    expect(SKILL_IDS).toHaveLength(18);
  });

  it("характеристика, спасбросок и навык — разные величины под своими именами", () => {
    expect(abilityStatId("dexterity")).toBe("ability:dexterity");
    expect(saveStatId("dexterity")).toBe("save:dexterity");
    expect(skillStatId("stealth")).toBe("skill:stealth");
  });

  it("имена величин не повторяются", () => {
    expect(new Set(STAT_IDS).size).toBe(STAT_IDS.length);
  });

  it("величиной считается только названная в словаре", () => {
    expect(isStatId("armorClass")).toBe(true);
    expect(isStatId("skill:stealth")).toBe(true);
    expect(isStatId("ability:luck")).toBe(false);
    expect(isStatId("charisma")).toBe(false);
  });
});

describe("форма вклада", () => {
  it("вклад называет свою цель, и цель обязана быть величиной", () => {
    expect(
      statContributionSchema.safeParse({ stat: "armorClass", kind: "bonus", value: 5 }).success,
    ).toBe(true);
    expect(
      statContributionSchema.safeParse({ stat: "armorClas", kind: "bonus", value: 5 }).success,
    ).toBe(false);
  });

  it("способ счёта от доспеха несёт базу и необязательную категорию", () => {
    const method = (value: unknown) =>
      statContributionSchema.safeParse({ stat: "armorClass", kind: "method", method: value })
        .success;

    expect(method({ family: "armor", base: 16, category: "heavy" })).toBe(true);
    expect(method({ family: "armor", base: 16 })).toBe(true);
    expect(method({ family: "armor", base: 16, category: "plate" })).toBe(false);
    expect(method({ family: "spell", base: 13 })).toBe(true);
    expect(method({ family: "blessing", base: 13 })).toBe(false);
  });

  it("четвёртого вида вклада не бывает", () => {
    expect(
      statContributionSchema.safeParse({ stat: "armorClass", kind: "multiplier", value: 2 })
        .success,
    ).toBe(false);
  });
});
