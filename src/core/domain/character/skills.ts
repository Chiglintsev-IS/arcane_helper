import { SKILL_IDS, type Ability, type SkillId } from "@/core/domain/shared/stats";

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

export const SKILL_TRAINING = ["proficient", "expert"] as const;

export type SkillTraining = (typeof SKILL_TRAINING)[number];

export function skillsOfAbility(ability: Ability): SkillId[] {
  return SKILL_IDS.filter((id) => SKILL_ABILITY[id] === ability);
}
