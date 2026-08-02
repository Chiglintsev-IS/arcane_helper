import { DomainError } from "@/core/domain/shared/errors";

import type { SkillTraining } from "./skills";

/**
 * Формулы листа персонажа: правила D&D 5e (2014) в виде функций.
 *
 * Прибавка предмета приходит слагаемым, а не спрятана в итоге: иначе правка характеристики не
 * сдвинула бы число, и расхождение с листом ничем себя не показало бы.
 */

/** Уровни персонажа, определённые правилами. */
export const MINIMUM_CHARACTER_LEVEL = 1;
export const MAXIMUM_CHARACTER_LEVEL = 20;

/** База КС спасброска от заклинаний. */
const SAVE_DC_BASE = 8;

function assertCharacterLevel(level: number): void {
  if (!Number.isInteger(level) || level < MINIMUM_CHARACTER_LEVEL || level > MAXIMUM_CHARACTER_LEVEL) {
    throw new DomainError(
      `Уровень персонажа должен быть целым от ${MINIMUM_CHARACTER_LEVEL} до ${MAXIMUM_CHARACTER_LEVEL}, получено: ${level}`,
    );
  }
}

/** Бонус мастерства: +2 на 1–4 уровнях, далее +1 за каждые четыре уровня. */
export function proficiencyBonus(level: number): number {
  assertCharacterLevel(level);
  return 2 + Math.floor((level - 1) / 4);
}

/** Модификатор характеристики. Значение 18 даёт +4. */
export function abilityModifier(score: number): number {
  if (!Number.isInteger(score)) {
    throw new DomainError(`Значение характеристики должно быть целым, получено: ${score}`);
  }
  return Math.floor((score - 10) / 2);
}

/** КС спасброска от заклинаний. Торн: 8 + 3 + 4 + 1 = 16. */
export function spellSaveDc(input: { level: number; score: number; itemBonus: number }): number {
  return SAVE_DC_BASE + proficiencyBonus(input.level) + abilityModifier(input.score) + input.itemBonus;
}

/** Модификатор атаки заклинанием. Торн: 3 + 4 + 1 = +8. */
export function spellAttackModifier(input: {
  level: number;
  score: number;
  itemBonus: number;
}): number {
  return proficiencyBonus(input.level) + abilityModifier(input.score) + input.itemBonus;
}

export function savingThrowModifier(input: {
  score: number;
  proficient: boolean;
  proficiencyBonus: number;
  itemBonus: number;
}): number {
  return (
    abilityModifier(input.score) + (input.proficient ? input.proficiencyBonus : 0) + input.itemBonus
  );
}

/** Компетентность удваивает бонус мастерства — таково правило. */
export function skillModifier(input: {
  score: number;
  training: SkillTraining | undefined;
  proficiencyBonus: number;
}): number {
  const trained = input.training === undefined ? 0 : input.proficiencyBonus;
  const doubled = input.training === "expert" ? input.proficiencyBonus : 0;
  return abilityModifier(input.score) + trained + doubled;
}

export const PASSIVE_BASE = 10;

export function passivePerception(input: Parameters<typeof skillModifier>[0]): number {
  return PASSIVE_BASE + skillModifier(input);
}

export function initiativeModifier(dexterity: number): number {
  return abilityModifier(dexterity);
}

/**
 * Лимит подготовленных заклинаний волшебника: модификатор Интеллекта + уровень волшебника.
 * Торн: 4 + 7 = 11. Заговоры в лимит не входят.
 */
export function preparedLimit(intelligence: number, wizardLevel: number): number {
  assertCharacterLevel(wizardLevel);
  return Math.max(1, abilityModifier(intelligence) + wizardLevel);
}
