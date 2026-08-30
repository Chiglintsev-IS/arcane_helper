import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import {
  MAXIMUM_CHARACTER_LEVEL,
  MINIMUM_CHARACTER_LEVEL,
} from "@/core/domain/shared/levels";
import {
  MAXIMUM_ABILITY_SCORE,
  MAXIMUM_EXHAUSTION,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { nonEmpty, parsedBySchema } from "@/core/domain/shared/schema";
import { ABILITIES, SKILL_IDS } from "@/core/domain/shared/stats";

import { characterFeaturesSchema } from "./features";
import { SKILL_TRAINING } from "./skills";

const abilityScore = z
  .number()
  .int()
  .min(MINIMUM_ABILITY_SCORE)
  .max(MAXIMUM_ABILITY_SCORE);

const characterLevel = z
  .number()
  .int()
  .min(MINIMUM_CHARACTER_LEVEL)
  .max(MAXIMUM_CHARACTER_LEVEL);

const age = z.number().int().nonnegative();
const speedFeet = z.number().int().nonnegative();

export const CREATURE_SIZES = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
] as const;

const abilitiesSchema = z.object({
  strength: abilityScore,
  dexterity: abilityScore,
  constitution: abilityScore,
  intelligence: abilityScore,
  wisdom: abilityScore,
  charisma: abilityScore,
});

export function isPossibleCharacterLevel(level: number): boolean {
  return characterLevel.safeParse(level).success;
}

export function parsedCharacterFields(
  fields: CharacterFields,
  patch: Partial<Record<keyof typeof CHARACTER_FIELDS, unknown>>,
): CharacterFields {
  const parsed = parsedBySchema(characterSchema, { ...fields, ...patch });
  if (!parsed.success) throw new DomainError(refusalOf(parsed.error));
  return parsed.data;
}

function refusalOf(error: z.ZodError): string {
  const [field] = error.issues.map((issue) => String(issue.path[0]));
  return `Поле «${field}» не годится: ${reasonsOf(error)}`;
}

function reasonsOf(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export const CHARACTER_FIELDS = {
  id: nonEmpty,
  name: nonEmpty,
  className: nonEmpty,
  level: characterLevel,
  species: nonEmpty.or(z.literal("")).default(""),
  subclass: nonEmpty.or(z.literal("")).default(""),
  age: age.default(0),
  size: z.enum(CREATURE_SIZES).default("medium"),
  speed: speedFeet.default(30),

  abilities: abilitiesSchema,
  saveProficiencies: z.array(z.enum(ABILITIES)).default([]),
  skills: z
    .partialRecord(z.enum(SKILL_IDS), z.enum(SKILL_TRAINING))
    .default({}),
  proficiencies: z
    .object({
      weapons: z.array(nonEmpty).default([]),
      armor: z.array(nonEmpty).default([]),
      tools: z.array(nonEmpty).default([]),
      languages: z.array(nonEmpty).default([]),
    })
    .default({ weapons: [], armor: [], tools: [], languages: [] }),

  features: characterFeaturesSchema,

  exhaustion: z.number().int().min(0).max(MAXIMUM_EXHAUSTION).default(0),
  inspiration: z.boolean().default(false),
};

const characterSchema = z.object(CHARACTER_FIELDS);

export type CharacterFields = DeepReadonly<z.infer<typeof characterSchema>>;
