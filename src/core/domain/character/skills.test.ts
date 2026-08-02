import { describe, expect, it } from "vitest";

import { ABILITIES, SKILL_ABILITY, SKILL_IDS, skillsOfAbility } from "./skills";

describe("таблица характеристик и навыков", () => {
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

  it("восемнадцать навыков, у каждого своя характеристика", () => {
    expect(SKILL_IDS).toHaveLength(18);
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(18);
    for (const id of SKILL_IDS) {
      expect(ABILITIES).toContain(SKILL_ABILITY[id]);
    }
  });

  it("навыки Интеллекта — те, что названы правилами", () => {
    expect(skillsOfAbility("intelligence")).toEqual([
      "arcana",
      "history",
      "investigation",
      "nature",
      "religion",
    ]);
  });

  it("каждый навык принадлежит ровно одной характеристике", () => {
    expect(ABILITIES.flatMap(skillsOfAbility)).toHaveLength(SKILL_IDS.length);
    expect(skillsOfAbility("constitution")).toEqual([]);
  });
});
