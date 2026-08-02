/**
 * Характеристики и навыки — данные правил D&D 5e (2014).
 *
 * Порядок характеристик — тот же, что на бумажном листе: по нему читают глазами, и другой порядок
 * заставил бы искать строку.
 */

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

/** Какой характеристикой бросается навык. */
export const SKILL_ABILITY: Record<SkillId, Ability> = {
  acrobatics: "dexterity",
  animalHandling: "wisdom",
  arcana: "intelligence",
  athletics: "strength",
  deception: "charisma",
  history: "intelligence",
  insight: "wisdom",
  intimidation: "charisma",
  investigation: "intelligence",
  medicine: "wisdom",
  nature: "intelligence",
  perception: "wisdom",
  performance: "charisma",
  persuasion: "charisma",
  religion: "intelligence",
  sleightOfHand: "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

/** Владение навыком: ничего, бонус мастерства, удвоенный бонус мастерства. */
export const SKILL_TRAINING = ["proficient", "expert"] as const;

export type SkillTraining = (typeof SKILL_TRAINING)[number];

/** Навыки, которые бросаются этой характеристикой, — в порядке листа персонажа. */
export function skillsOfAbility(ability: Ability): SkillId[] {
  return SKILL_IDS.filter((id) => SKILL_ABILITY[id] === ability);
}
