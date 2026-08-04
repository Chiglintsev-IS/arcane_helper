/**
 * Производные числа листа: одно место, где они считаются.
 *
 * Хранение готовых чисел означало бы, что правка уровня или характеристики оставит их прежними, и
 * расхождение не покажет себя ничем — приложение просто назовёт мастеру не тот КС. Перебивка
 * остаётся для случая, когда за столом действует не то, что даёт формула.
 */

import {
  abilityModifier,
  initiativeModifier,
  passivePerception,
  preparedLimit,
  proficiencyBonus,
  savingThrowModifier,
  skillModifier,
  spellAttackModifier,
  spellSaveDc,
} from "@/core/domain/character/abilities";
import { ABILITIES, SKILL_ABILITY, SKILL_IDS, type Ability, type SkillId } from "@/core/domain/character/skills";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
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
type DerivedValue = { value: number; overridden: boolean; formula: number };

export type DerivedNumber = DerivedValue & { id: DerivedId };

/** Перебивка поверх формулы: её отсутствие и означает счёт. */
export function derivedValue(override: number | undefined, formula: number): DerivedValue {
  return { value: override ?? formula, overridden: override !== undefined, formula };
}

/**
 * Основания счёта: база персонажа, его прочие прибавки и вклад снаряжения.
 *
 * Снаряжение приходит отдельным полем, а не полем персонажа: так контекст персонажа остаётся листом
 * графа зависимостей и не узнаёт ни про вещи, ни про инвентарь.
 */
export type SheetInput = Pick<
  CharacterFields,
  "level" | "abilities" | "saveProficiencies" | "skills" | "overrides" | "miscBonuses"
> & {
  bonuses: ItemBonuses;
  armorClassBase: number;
};

export type DerivedNumbers = Record<DerivedId, DerivedValue> & {
  saves: Record<Ability, number>;
  skills: Record<SkillId, number>;
};

export function deriveNumbers(sheet: SheetInput): DerivedNumbers {
  const { overrides } = sheet;
  const proficiency = derivedValue(overrides.proficiencyBonus, proficiencyBonus(sheet.level));
  const bonus = proficiency.value;
  const spellcastingScore = sheet.abilities[SPELLCASTING_ABILITY];
  // Вклад надетых вещей и прочие прибавки персонажа складываются: источники разные, правило одно.
  const spellcastingBonus = sheet.bonuses.spellcasting + sheet.miscBonuses.spellcasting;
  const savingThrowBonus = sheet.bonuses.savingThrows + sheet.miscBonuses.savingThrows;

  const saves = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    saves[ability] =
      overrides.saves[ability] ??
      savingThrowModifier({
        score: sheet.abilities[ability],
        proficient: sheet.saveProficiencies.includes(ability),
        proficiencyBonus: bonus,
        itemBonus: savingThrowBonus,
      });
  }

  const skills = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) {
    skills[id] =
      overrides.skills[id] ??
      skillModifier({
        score: sheet.abilities[SKILL_ABILITY[id]],
        training: sheet.skills[id],
        proficiencyBonus: bonus,
      });
  }

  return {
    proficiencyBonus: proficiency,
    spellSaveDc: derivedValue(
      overrides.spellSaveDc,
      spellSaveDc({
        proficiencyBonus: bonus,
        score: spellcastingScore,
        itemBonus: spellcastingBonus,
      }),
    ),
    spellAttackModifier: derivedValue(
      overrides.spellAttackModifier,
      spellAttackModifier({
        proficiencyBonus: bonus,
        score: spellcastingScore,
        itemBonus: spellcastingBonus,
      }),
    ),
    preparedLimit: derivedValue(
      overrides.preparedLimit,
      preparedLimit(spellcastingScore, sheet.level),
    ),
    initiative: derivedValue(
      overrides.initiative,
      initiativeModifier({
        dexterity: sheet.abilities.dexterity,
        wisdom: sheet.abilities.wisdom,
      }),
    ),
    passivePerception: derivedValue(
      overrides.passivePerception,
      passivePerception({
        score: sheet.abilities.wisdom,
        training: sheet.skills.perception,
        proficiencyBonus: bonus,
      }),
    ),
    saves,
    skills,
  };
}
