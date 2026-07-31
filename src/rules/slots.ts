/**
 * Ячейки заклинаний: таблица, списание, возврат, восстановление.
 *
 * Реализует FR-070…FR-073, FR-130…FR-132. Таблица — docs/rules-engine.md#ячейки-заклинаний.
 */

import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL, RulesError } from "./abilities";

export const CANTRIP_LEVEL = 0;
export const MINIMUM_SPELL_LEVEL = 1;
export const MAXIMUM_SPELL_LEVEL = 9;

/** Максимальный уровень ячейки, которую возвращает «Магическое восстановление». */
export const ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL = 5;

export type SpellSlots = Record<number, { maximum: number; remaining: number }>;

/**
 * Таблица ячеек полного заклинателя по уровням 1–20.
 * Индекс массива — уровень персонажа минус один; элемент — ячейки уровней 1..9.
 */
const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

function assertSlotLevel(slotLevel: number): void {
  if (!Number.isInteger(slotLevel) || slotLevel < MINIMUM_SPELL_LEVEL || slotLevel > MAXIMUM_SPELL_LEVEL) {
    throw new RulesError(
      `Уровень ячейки должен быть целым от ${MINIMUM_SPELL_LEVEL} до ${MAXIMUM_SPELL_LEVEL}, получено: ${slotLevel}`,
    );
  }
}

/** Ячейки волшебника указанного уровня. Для 7 уровня — 4 / 3 / 3 / 1. */
export function spellSlotsForLevel(wizardLevel: number): SpellSlots {
  // Одна проверка вместо двух: нецелый, нулевой и запредельный уровень равно дают пустую строку.
  const row = FULL_CASTER_SLOTS[wizardLevel - 1];
  if (row === undefined) {
    throw new RulesError(
      `Уровень волшебника должен быть целым от ${MINIMUM_CHARACTER_LEVEL} до ${MAXIMUM_CHARACTER_LEVEL}, получено: ${wizardLevel}`,
    );
  }

  const slots: SpellSlots = {};
  row.forEach((maximum, index) => {
    slots[index + 1] = { maximum, remaining: maximum };
  });
  return slots;
}

/** Наивысший уровень ячейки, доступный персонажу. Для 7 уровня — 4. */
export function highestSlotLevel(slots: SpellSlots): number {
  const levels = Object.keys(slots).map(Number);
  return levels.length === 0 ? 0 : Math.max(...levels);
}

export type CastMode = "normal" | "ritual" | "cantrip";

/**
 * Расходует ли применение ячейку.
 * Заговоры не расходуют (FR-072), ритуальное применение не расходует (FR-073).
 */
export function consumesSlot(spellLevel: number, mode: CastMode): boolean {
  if (spellLevel === CANTRIP_LEVEL) return false;
  return mode === "normal";
}

/** Есть ли свободная ячейка указанного уровня. */
export function hasSlotAvailable(slots: SpellSlots, slotLevel: number): boolean {
  assertSlotLevel(slotLevel);
  const slot = slots[slotLevel];
  return slot !== undefined && slot.remaining > 0;
}

/**
 * Списывает ячейку. Возвращает новый объект — состояние не мутируется.
 *
 * Списание без свободной ячейки допускается только при `allowOverdraft`: мастер вправе
 * разрешить исключение (FR-031), и тогда `remaining` уходит в минус и показывается как долг.
 */
export function spendSlot(
  slots: SpellSlots,
  slotLevel: number,
  options: { allowOverdraft?: boolean } = {},
): SpellSlots {
  assertSlotLevel(slotLevel);
  const slot = slots[slotLevel];
  if (slot === undefined) {
    throw new RulesError(`У персонажа нет ячеек ${slotLevel} уровня`);
  }
  if (slot.remaining <= 0 && options.allowOverdraft !== true) {
    throw new RulesError(`Нет свободной ячейки ${slotLevel} уровня`);
  }
  return { ...slots, [slotLevel]: { ...slot, remaining: slot.remaining - 1 } };
}

/**
 * Возвращает ошибочно потраченную ячейку (FR-071).
 * Возврат выше максимума запрещён: расхождение означает испорченное состояние.
 */
export function refundSlot(slots: SpellSlots, slotLevel: number): SpellSlots {
  assertSlotLevel(slotLevel);
  const slot = slots[slotLevel];
  if (slot === undefined) {
    throw new RulesError(`У персонажа нет ячеек ${slotLevel} уровня`);
  }
  if (slot.remaining >= slot.maximum) {
    throw new RulesError(
      `Ячейки ${slotLevel} уровня уже восстановлены полностью (${slot.remaining} из ${slot.maximum})`,
    );
  }
  return { ...slots, [slotLevel]: { ...slot, remaining: slot.remaining + 1 } };
}

/** Уровни ячеек, которыми можно сотворить заклинание: от собственного уровня и выше. */
export function castableSlotLevels(slots: SpellSlots, spellLevel: number): number[] {
  if (spellLevel === CANTRIP_LEVEL) return [];
  assertSlotLevel(spellLevel);
  return Object.keys(slots)
    .map(Number)
    .filter((level) => level >= spellLevel)
    .sort((left, right) => left - right);
}

/** Долгий отдых: все ячейки восстанавливаются до максимума (FR-130). */
export function restoreAllSlots(slots: SpellSlots): SpellSlots {
  const restored: SpellSlots = {};
  for (const [level, slot] of Object.entries(slots)) {
    restored[Number(level)] = { ...slot, remaining: slot.maximum };
  }
  return restored;
}

/** Бюджет «Магического восстановления»: половина уровня волшебника с округлением вверх. */
export function arcaneRecoveryBudget(wizardLevel: number): number {
  if (
    !Number.isInteger(wizardLevel) ||
    wizardLevel < MINIMUM_CHARACTER_LEVEL ||
    wizardLevel > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new RulesError(`Уровень волшебника вне допустимого диапазона: ${wizardLevel}`);
  }
  return Math.ceil(wizardLevel / 2);
}

/** Сколько ячеек каждого уровня вернуть: «уровень ячейки → количество». */
export type SlotRecoveryPlan = Record<number, number>;

export type RecoveryValidation =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Проверяет план восстановления: суммарный уровень в пределах бюджета, уровень ячейки не выше
 * пятого, и ни по одному уровню не превышен максимум (FR-131).
 */
export function validateArcaneRecovery(
  slots: SpellSlots,
  plan: SlotRecoveryPlan,
  wizardLevel: number,
): RecoveryValidation {
  const budget = arcaneRecoveryBudget(wizardLevel);
  let spentBudget = 0;

  for (const [rawLevel, rawCount] of Object.entries(plan)) {
    const level = Number(rawLevel);
    const count = rawCount;

    if (count === 0) continue;
    if (!Number.isInteger(count) || count < 0) {
      return { valid: false, reason: `Количество ячеек ${level} уровня должно быть целым неотрицательным` };
    }
    if (level > ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL) {
      return {
        valid: false,
        reason: `Магическое восстановление не возвращает ячейки выше ${ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL} уровня`,
      };
    }

    const slot = slots[level];
    if (slot === undefined) {
      return { valid: false, reason: `У персонажа нет ячеек ${level} уровня` };
    }
    if (slot.remaining + count > slot.maximum) {
      return {
        valid: false,
        reason: `Ячеек ${level} уровня нельзя вернуть больше, чем потрачено (потрачено ${slot.maximum - slot.remaining})`,
      };
    }

    spentBudget += level * count;
  }

  if (spentBudget === 0) {
    return { valid: false, reason: "План восстановления пуст" };
  }
  if (spentBudget > budget) {
    return {
      valid: false,
      reason: `Суммарный уровень возвращаемых ячеек ${spentBudget} превышает бюджет ${budget}`,
    };
  }
  return { valid: true };
}

/** Применяет проверенный план восстановления. Некорректный план — ошибка, а не частичный результат. */
export function applyArcaneRecovery(
  slots: SpellSlots,
  plan: SlotRecoveryPlan,
  wizardLevel: number,
): SpellSlots {
  const validation = validateArcaneRecovery(slots, plan, wizardLevel);
  if (!validation.valid) {
    throw new RulesError(validation.reason);
  }

  const recovered: SpellSlots = {};
  for (const [level, slot] of Object.entries(slots)) {
    recovered[Number(level)] = { ...slot };
  }
  for (const [rawLevel, count] of Object.entries(plan)) {
    const level = Number(rawLevel);
    const slot = recovered[level];
    if (slot !== undefined && count > 0) {
      recovered[level] = { ...slot, remaining: slot.remaining + count };
    }
  }
  return recovered;
}
