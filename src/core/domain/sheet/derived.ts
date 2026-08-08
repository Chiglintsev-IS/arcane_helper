import {
  initiativeModifier,
  passivePerception,
  preparedLimit,
  proficiencyBonus,
  savingThrowModifier,
  skillModifier,
  spellAttackModifier,
  spellSaveDc,
} from "@/core/domain/character/abilities";
import {
  ABILITIES,
  SKILL_ABILITY,
  SKILL_IDS,
  type Ability,
  type SkillId,
} from "@/core/domain/character/skills";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import { recordOf } from "@/core/domain/shared/records";
import type { CharacterFields } from "@/core/domain/character/schema";
import type { ItemBonuses } from "@/core/domain/shared/schema";

export type DerivedId =
  | "proficiencyBonus"
  | "spellSaveDc"
  | "spellAttackModifier"
  | "preparedLimit"
  | "initiative"
  | "passivePerception";

export const DERIVED_IDS: readonly DerivedId[] = [
  "proficiencyBonus",
  "spellSaveDc",
  "spellAttackModifier",
  "preparedLimit",
  "initiative",
  "passivePerception",
];

/**
 * Одно производное число: что действует, введено ли это руками и что даёт формула.
 *
 * Формула отдаётся рядом с действующим значением, потому что спрашивают их вместе: перебивку
 * набирают, глядя на то, от чего отступают, а снимают возвратом к формуле.
 */
type DerivedValue = { value: number };

export type DerivedNumber = DerivedValue & { id: DerivedId };

/** Перебивка поверх формулы: её отсутствие и означает счёт. */
export function derivedValue(formula: number): DerivedValue {
  return {
    value: formula,
  };
}

/**
 * Основания счёта: база персонажа, его прочие прибавки и вклад снаряжения.
 *
 * Снаряжение приходит отдельным полем, а не полем персонажа: так контекст персонажа остаётся листом
 * графа зависимостей и не узнаёт ни про вещи, ни про инвентарь.
 */
export type SheetInput = Pick<
  CharacterFields,
  "level" | "abilities" | "saveProficiencies" | "skills"
>;

export type DerivedNumbers = {
  saves: Record<Ability, number>;
  skills: Record<SkillId, number>;
};

export function deriveNumbers(sheet: SheetInput): DerivedNumbers {
  const proficiency = proficiencyBonus(sheet.level);
  const bonus = proficiency;
  const spellcastingScore = sheet.abilities[SPELLCASTING_ABILITY];

  const saves = recordOf(
    ABILITIES,
    (ability) =>
      savingThrowModifier({
        score: sheet.abilities[ability],
        proficient: sheet.saveProficiencies.includes(ability),
        proficiencyBonus: bonus,
      }),
  );

  const skills = recordOf(SKILL_IDS, (id) =>
    skillModifier({
      score: sheet.abilities[SKILL_ABILITY[id]],
      training: sheet.skills[id],
      proficiencyBonus: bonus,
    }),
  );

  return {
    saves,
    skills,
  };
}
