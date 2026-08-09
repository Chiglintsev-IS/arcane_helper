import { describe, expect, it } from "vitest";

import { choicesViewSchema } from "@/contract/views";

import { RUNE_TARGETS } from "@/core/domain/arcana/runes";
import {
  EXHAUSTION_STEPS,
  MAXIMUM_ABILITY_SCORE,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { CREATURE_SIZES } from "@/core/domain/character/schema";
import { SKILL_TRAINING } from "@/core/domain/character/skills";
import { ITEM_KINDS } from "@/core/domain/items/schema";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { ARMOR_CATEGORIES, STAT_IDS } from "@/core/domain/shared/stats";

import { toChoicesView } from "./choicesView";

describe("перечни выбора", () => {
  it("едут теми же перечнями, которыми пользуются правила", () => {
    const choices = toChoicesView();

    expect(choices.stats.map((stat) => stat.id)).toEqual([...STAT_IDS]);
    expect(choices.creatureSizes).toEqual([...CREATURE_SIZES]);
    expect(choices.itemKinds).toEqual([...ITEM_KINDS]);
    expect(choices.armorCategories).toEqual([...ARMOR_CATEGORIES]);
    expect(choices.currencies).toEqual([...CURRENCIES]);
    expect(choices.skillTrainings).toEqual([...SKILL_TRAINING]);
    expect(choices.runeTargets).toEqual([...RUNE_TARGETS]);
    expect(choices.exhaustionSteps).toEqual([...EXHAUSTION_STEPS]);
  });

  it("называет величину вместе с разбором её имени", () => {
    const { stats } = toChoicesView();

    expect(stats.find((stat) => stat.id === "armorClass")).toEqual({
      id: "armorClass",
      kind: "singular",
    });
    expect(stats.find((stat) => stat.id === "ability:strength")).toEqual({
      id: "ability:strength",
      kind: "ability",
      of: "strength",
    });
    expect(stats.find((stat) => stat.id === "save:constitution")).toEqual({
      id: "save:constitution",
      kind: "save",
      of: "constitution",
    });
    expect(stats.find((stat) => stat.id === "skill:arcana")).toEqual({
      id: "skill:arcana",
      kind: "skill",
      of: "arcana",
    });
  });

  it("везёт границы набираемых чисел от их владельцев", () => {
    const choices = toChoicesView();

    expect(choices.characterLevel).toEqual({
      minimum: MINIMUM_CHARACTER_LEVEL,
      maximum: MAXIMUM_CHARACTER_LEVEL,
    });
    expect(choices.abilityScore).toEqual({
      minimum: MINIMUM_ABILITY_SCORE,
      maximum: MAXIMUM_ABILITY_SCORE,
    });
  });

  it("проходит форму договора", () => {
    expect(choicesViewSchema.safeParse(toChoicesView()).success).toBe(true);
  });
});
