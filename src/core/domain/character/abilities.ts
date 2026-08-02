import { DomainError } from "@/core/domain/shared/errors";
/**
 * Производные характеристики персонажа.
 *
 * Все функции здесь возвращают значение по умолчанию: предметы и черты сдвигают итоговые числа,
 * поэтому фактические значения хранятся полями состояния, а не вычисляются в месте использования.
 */

/** Уровни персонажа, определённые правилами. */
export const MINIMUM_CHARACTER_LEVEL = 1;
export const MAXIMUM_CHARACTER_LEVEL = 20;

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

/** Базовая КС спасброска от заклинаний. Торн: 8 + 3 + 4 = 15. */
export function baseSpellSaveDc(level: number, spellcastingAbilityScore: number): number {
  return 8 + proficiencyBonus(level) + abilityModifier(spellcastingAbilityScore);
}

/** Базовый модификатор атаки заклинанием. Торн: 3 + 4 = +7. */
export function baseSpellAttackModifier(level: number, spellcastingAbilityScore: number): number {
  return proficiencyBonus(level) + abilityModifier(spellcastingAbilityScore);
}

/**
 * Лимит подготовленных заклинаний волшебника: модификатор Интеллекта + уровень волшебника.
 * Торн: 4 + 7 = 11. Заговоры в лимит не входят.
 */
export function preparedLimit(intelligence: number, wizardLevel: number): number {
  assertCharacterLevel(wizardLevel);
  return Math.max(1, abilityModifier(intelligence) + wizardLevel);
}
