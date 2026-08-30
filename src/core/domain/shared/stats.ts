import { z } from "zod";

export const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export type Ability = (typeof ABILITIES)[number];

export const SKILL_IDS = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

const SINGULAR_STAT_IDS = [
  "armorClass",
  "spellSaveDc",
  "spellAttackModifier",
  "initiative",
  "passivePerception",
  "preparedLimit",
  "proficiencyBonus",
  "speed",
] as const;

type AbilityStatId = `ability:${Ability}`;
type SaveStatId = `save:${Ability}`;
type SkillStatId = `skill:${SkillId}`;

export type StatId =
  | (typeof SINGULAR_STAT_IDS)[number]
  | AbilityStatId
  | SaveStatId
  | SkillStatId;

export function abilityStatId(ability: Ability): AbilityStatId {
  return `ability:${ability}`;
}

export function saveStatId(ability: Ability): SaveStatId {
  return `save:${ability}`;
}

export function skillStatId(skill: SkillId): SkillStatId {
  return `skill:${skill}`;
}

type StatKind = "singular" | "ability" | "save" | "skill";

export const STATS: readonly {
  readonly id: StatId;
  readonly kind: StatKind;
  readonly of?: Ability | SkillId;
}[] = [
  ...SINGULAR_STAT_IDS.map((id) => ({ id, kind: "singular" as const })),
  ...ABILITIES.map((of) => ({ id: abilityStatId(of), kind: "ability" as const, of })),
  ...ABILITIES.map((of) => ({ id: saveStatId(of), kind: "save" as const, of })),
  ...SKILL_IDS.map((of) => ({ id: skillStatId(of), kind: "skill" as const, of })),
];

export const STAT_IDS: readonly StatId[] = STATS.map((stat) => stat.id);

export function isStatId(value: string): value is StatId {
  return STAT_IDS.some((id) => id === value);
}

export const ARMOR_CATEGORIES = ["light", "medium", "heavy"] as const;

export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

export type StatMethod =
  | {
      readonly family: "armor";
      readonly base: number;
      readonly category?: ArmorCategory | undefined;
    }
  | { readonly family: "spell"; readonly base: number };

export type StatContribution =
  | { readonly stat: StatId; readonly kind: "method"; readonly method: StatMethod }
  | { readonly stat: StatId; readonly kind: "bonus"; readonly value: number }
  | { readonly stat: StatId; readonly kind: "assignment"; readonly value: number };

export type ContributionSource = {
  readonly origin: "item" | "effect";
  readonly nameRu: string;
};

export type SourcedContribution = {
  readonly source: ContributionSource;
  readonly contribution: StatContribution;
};

export const statBonusesSchema = z.partialRecord(z.enum(STAT_IDS), z.number().int());

const statId = z.enum(STAT_IDS, { error: "Такой величины не бывает" });

const statMethodSchema = z.discriminatedUnion("family", [
  z.object({
    family: z.literal("armor"),
    base: z.number().int().positive(),
    category: z.enum(ARMOR_CATEGORIES).optional(),
  }),
  z.object({ family: z.literal("spell"), base: z.number().int().positive() }),
]);

export const statContributionSchema = z.discriminatedUnion("kind", [
  z.object({ stat: statId, kind: z.literal("method"), method: statMethodSchema }),
  z.object({ stat: statId, kind: z.literal("bonus"), value: z.number().int() }),
  z.object({ stat: statId, kind: z.literal("assignment"), value: z.number().int() }),
]);
