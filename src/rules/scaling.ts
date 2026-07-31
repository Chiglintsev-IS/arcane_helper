/**
 * Повышение уровня заклинания и масштабирование заговоров.
 *
 * Масштабирование хранится данными, а не кодом. Ключи `damage.scaling` трактуются по-разному
 * в зависимости от уровня заклинания — см. docs/rules-engine.md#повышение-уровня-заклинания.
 */

import { CANTRIP_LEVEL } from "./slots";

export type DamageSpec = {
  dice: string;
  type: string;
  scaling?: Record<number, string>;
};

/**
 * Формула урона заклинания уровня 1 и выше при сотворении ячейкой `slotLevel`.
 * Ключи `scaling` — уровни ячейки; при отсутствии ключа берётся базовая формула.
 */
export function damageAtSlotLevel(damage: DamageSpec, slotLevel: number): string {
  return damage.scaling?.[slotLevel] ?? damage.dice;
}

/**
 * Формула урона заговора на указанном уровне персонажа.
 * Ключи `scaling` — пороги уровня персонажа (в 5e это 5, 11 и 17);
 * берётся наибольший ключ, не превышающий уровень персонажа.
 */
export function cantripDamageAtCharacterLevel(damage: DamageSpec, characterLevel: number): string {
  let highestReached = Number.NEGATIVE_INFINITY;
  let formula: string | undefined;

  for (const [threshold, thresholdFormula] of Object.entries(damage.scaling ?? {})) {
    const level = Number(threshold);
    if (level <= characterLevel && level > highestReached) {
      highestReached = level;
      formula = thresholdFormula;
    }
  }

  return formula ?? damage.dice;
}

/**
 * Единая точка расчёта урона: сама выбирает ветку по уровню заклинания.
 * Для заговора `slotLevel` игнорируется, для остальных — игнорируется `characterLevel`.
 */
export function effectiveDamage(
  damage: DamageSpec,
  context: { spellLevel: number; slotLevel: number; characterLevel: number },
): string {
  return context.spellLevel === CANTRIP_LEVEL
    ? cantripDamageAtCharacterLevel(damage, context.characterLevel)
    : damageAtSlotLevel(damage, context.slotLevel);
}

/** Даёт ли повышение уровня видимый эффект — нужно на шаге выбора ячейки (FR-071). */
export function upcastChangesDamage(damage: DamageSpec, spellLevel: number, slotLevel: number): boolean {
  if (slotLevel <= spellLevel) return false;
  return damageAtSlotLevel(damage, slotLevel) !== damageAtSlotLevel(damage, spellLevel);
}
