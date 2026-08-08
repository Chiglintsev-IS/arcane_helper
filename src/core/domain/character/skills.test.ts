import { describe, expect, it } from "vitest";

import { ABILITIES, SKILL_IDS } from "@/core/domain/shared/stats";

import { SKILL_ABILITY, skillsOfAbility } from "./skills";

describe("таблица характеристик и навыков", () => {
  it("у каждого навыка своя характеристика", () => {
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(SKILL_IDS.length);
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
