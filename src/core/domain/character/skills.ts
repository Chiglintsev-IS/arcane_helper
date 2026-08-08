/**
 * Навыки персонажа: какой характеристикой их бросают и чем персонаж владеет.
 *
 * Имена характеристик и навыков живут не здесь, а в словаре величин: ими называют цель вклада и
 * каталог, и снаряжение, и эффекты, а через персонажа это имя к ним не пришло бы — им пришлось бы
 * знать про персонажа ради одного слова.
 */

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

/** Владение навыком: ничего, бонус мастерства, удвоенный бонус мастерства. */
export const SKILL_TRAINING = ["proficient", "expert"] as const;

export type SkillTraining = (typeof SKILL_TRAINING)[number];

/** Навыки, которые бросаются этой характеристикой, — в порядке листа персонажа. */
export function skillsOfAbility(ability: Ability): SkillId[] {
  return SKILL_IDS.filter((id) => SKILL_ABILITY[id] === ability);
}
