/**
 * Ячейки заклинаний: таблица, списание, возврат, восстановление.
 *
 * Таблица ячеек полного заклинателя — ниже, в самом модуле: это данные правил, а не настройка.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { CANTRIP_LEVEL, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { ResourcePool } from "@/core/domain/shared/resourcePool";

/** Ячейки начинаются с первого уровня: заговор ячейки не занимает, и нулевой ячейки не бывает. */
export const MINIMUM_SPELL_LEVEL = 1;

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
    throw new DomainError(
      `Уровень ячейки должен быть целым от ${MINIMUM_SPELL_LEVEL} до ${MAXIMUM_SPELL_LEVEL}, получено: ${slotLevel}`,
    );
  }
}

/**
 * Новая таблица ячеек при смене уровня: остаток движется на разницу максимумов, исчезнувшие уровни
 * уходят целиком.
 */
export function resizeSlots(slots: SpellSlots, wizardLevel: number): SpellSlots {
  const table = spellSlotsForLevel(wizardLevel);
  const resized: SpellSlots = {};
  for (const [key, target] of Object.entries(table)) {
    const level = Number(key);
    const current = slots[level];
    resized[level] =
      current === undefined
        ? target
        : ResourcePool.from(current, `Ячеек ${level} уровня`).resized(target.maximum).toState();
  }
  return resized;
}

/** Ячейки волшебника указанного уровня. Для 7 уровня — 4 / 3 / 3 / 1. */
export function spellSlotsForLevel(wizardLevel: number): SpellSlots {
  // Одна проверка вместо двух: нецелый, нулевой и запредельный уровень равно дают пустую строку.
  const row = FULL_CASTER_SLOTS[wizardLevel - 1];
  if (row === undefined) {
    throw new DomainError(
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
 * Заговоры не расходуют, ритуальное применение не расходует.
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
 * разрешить исключение, и тогда `remaining` уходит в минус и показывается как долг.
 */
export function spendSlot(
  slots: SpellSlots,
  slotLevel: number,
  options: { allowOverdraft?: boolean } = {},
): SpellSlots {
  assertSlotLevel(slotLevel);
  const slot = slots[slotLevel];
  if (slot === undefined) {
    throw new DomainError(`У персонажа нет ячеек ${slotLevel} уровня`);
  }
  if (slot.remaining <= 0 && options.allowOverdraft !== true) {
    throw new DomainError(`Нет свободной ячейки ${slotLevel} уровня`);
  }
  return { ...slots, [slotLevel]: { ...slot, remaining: slot.remaining - 1 } };
}

/**
 * Возвращает ошибочно потраченную ячейку.
 * Возврат выше максимума запрещён: расхождение означает испорченное состояние.
 */
export function refundSlot(slots: SpellSlots, slotLevel: number): SpellSlots {
  assertSlotLevel(slotLevel);
  const slot = slots[slotLevel];
  if (slot === undefined) {
    throw new DomainError(`У персонажа нет ячеек ${slotLevel} уровня`);
  }
  if (slot.remaining >= slot.maximum) {
    throw new DomainError(
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

/** Долгий отдых: все ячейки восстанавливаются до максимума. */
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
    throw new DomainError(`Уровень волшебника вне допустимого диапазона: ${wizardLevel}`);
  }
  return Math.ceil(wizardLevel / 2);
}

/** Сколько ячеек каждого уровня вернуть: «уровень ячейки → количество». */
export type SlotRecoveryPlan = Record<number, number>;

export type RecoveryValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** Суммарный уровень плана: сколько остатка бюджета он расходует. */
export function arcaneRecoveryPlanCost(plan: SlotRecoveryPlan): number {
  return Object.entries(plan).reduce((total, [level, count]) => total + Number(level) * count, 0);
}

/** Ячейка, которую «Магическое восстановление» вправе вернуть: её уровень и сколько потрачено. */
export type RecoverableSlot = { level: number; maximum: number; remaining: number };

/**
 * Ячейки, которые восстановление вправе вернуть: не выше своего предела уровня и потраченные.
 *
 * Порядок — от младших к старшим: правило говорит о суммарном уровне, и выбирать удобнее снизу.
 */
export function recoverableSlots(slots: SpellSlots): RecoverableSlot[] {
  return Object.entries(slots)
    .map(([level, slot]) => ({ level: Number(level), ...slot }))
    .filter(
      (slot) => slot.level <= ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL && slot.remaining < slot.maximum,
    )
    .sort((left, right) => left.level - right.level);
}

/**
 * Проверяет план восстановления: суммарный уровень в пределах переданного остатка бюджета, уровень
 * ячейки не выше пятого, и ни по одному уровню не превышен максимум.
 *
 * Бюджет приходит параметром, а не уровнем волшебника: за столом его берут частями, и сколько
 * осталось — знает только текущий остаток пула, а не формула по уровню.
 */
export function validateArcaneRecovery(
  slots: SpellSlots,
  plan: SlotRecoveryPlan,
  budget: number,
): RecoveryValidation {
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
  }

  const spentBudget = arcaneRecoveryPlanCost(plan);
  if (spentBudget === 0) {
    return { valid: false, reason: "План восстановления пуст" };
  }
  if (spentBudget > budget) {
    return {
      valid: false,
      reason: `Суммарный уровень возвращаемых ячеек ${spentBudget} превышает остаток бюджета ${budget}`,
    };
  }
  return { valid: true };
}

/** Применяет проверенный план восстановления. Некорректный план — ошибка, а не частичный результат. */
export function applyArcaneRecovery(
  slots: SpellSlots,
  plan: SlotRecoveryPlan,
  budget: number,
): SpellSlots {
  const validation = validateArcaneRecovery(slots, plan, budget);
  if (!validation.valid) {
    throw new DomainError(validation.reason);
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

// ── Тариф кровавого колдовства ──────────────────────────────────────────────
// Знание о стоимости очков принадлежит arcana: ячейки, очки и тариф — одно пространство.

/** Максимальный уровень заклинания, который вообще оплачивается очками. */
export const MAXIMUM_PAYABLE_SPELL_LEVEL = 5;

/** Стоимость заклинания в очках заклинаний по уровню. */
const SPELL_POINT_COSTS: Readonly<Record<number, number>> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

/** Ступени возвышения: сколько хитов отдаётся за одно очко заклинаний. */
const ASCENSION_TIERS: readonly { readonly upToLevel: number; readonly hitPointsPerPoint: number }[] = [
  { upToLevel: 4, hitPointsPerPoint: 2 },
  { upToLevel: 8, hitPointsPerPoint: 3 },
  { upToLevel: 12, hitPointsPerPoint: 4 },
  { upToLevel: 16, hitPointsPerPoint: 5 },
  { upToLevel: 20, hitPointsPerPoint: 6 },
];

/** Стоимость заклинания в очках заклинаний. */
export function spellPointCost(spellLevel: number): number {
  const cost = SPELL_POINT_COSTS[spellLevel];
  if (cost === undefined) {
    throw new DomainError(
      `Очками заклинаний оплачиваются только уровни 1…${MAXIMUM_PAYABLE_SPELL_LEVEL}, получено: ${spellLevel}`,
    );
  }
  return cost;
}

/**
 * Курс обмена на данном уровне. Для Торна (7 уровень) — 3 хита за очко.
 *
 * Поиск ступени служит и проверкой уровня: нецелый, нулевой и запредельный уровень
 * не попадают ни в одну ступень.
 */
export function ascensionTierRate(level: number): number {
  const tier =
    Number.isInteger(level) && level >= MINIMUM_CHARACTER_LEVEL
      ? ASCENSION_TIERS.find((candidate) => level <= candidate.upToLevel)
      : undefined;
  if (tier === undefined) {
    throw new DomainError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
  return tier.hitPointsPerPoint;
}

/** Цена очков в хитах: очки, умноженные на курс ступени. */
export function hitPointsForPoints(points: number, level: number): number {
  if (!Number.isInteger(points) || points < 0) {
    throw new DomainError(`Число очков должно быть целым неотрицательным, получено: ${points}`);
  }
  return points * ascensionTierRate(level);
}

/** Стоимость заклинания в хитах. */
export function hitPointCost(spellLevel: number, level: number): number {
  return hitPointsForPoints(spellPointCost(spellLevel), level);
}

/**
 * Потолок одного обмена: сколько очков покупается на текущие хиты.
 *
 * Не меньше одного даже при нехватке хитов: обмен до нуля разрешён и даёт раны, а запрещать его —
 * решение за игрока. Нехватку называет отдельная проверка доступности.
 */
export function maximumExchangePoints(currentHitPoints: number, level: number): number {
  return Math.max(1, Math.floor(currentHitPoints / ascensionTierRate(level)));
}

/** Уровни заклинаний, которые оплачиваются указанным числом очков. */
export function affordableSpellLevels(points: number): number[] {
  const levels: number[] = [];
  for (let level = MINIMUM_SPELL_LEVEL; level <= MAXIMUM_PAYABLE_SPELL_LEVEL; level += 1) {
    if (spellPointCost(level) <= points) levels.push(level);
  }
  return levels;
}
