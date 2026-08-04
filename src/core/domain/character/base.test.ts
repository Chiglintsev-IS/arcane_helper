import { describe, expect, it } from "vitest";

import { CharacterBase } from "@/core/domain/character/base";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

describe("персонаж: база без вещей", () => {
  it("уровень, бонус мастерства и модификаторы берутся из характеристик", () => {
    const base = CharacterBase.of(createThorne());
    expect(base.level).toBe(7);
    expect(base.proficiencyBonus).toBe(3);
    expect(base.spellcastingModifier).toBe(4);
    expect(base.modifier("strength")).toBe(-1);
  });
});
