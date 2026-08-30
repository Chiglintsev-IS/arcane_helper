import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { CANTRIP_LEVEL, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { ResourcePool } from "@/core/domain/shared/resourcePool";

export const MINIMUM_SPELL_LEVEL = 1;

const ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL = 5;

export type SpellSlots = Record<number, { maximum: number; remaining: number }>;

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

export function resizeSlots(slots: SpellSlots, wizardLevel: number): SpellSlots {
  const table = spellSlotsForLevel(wizardLevel);
  const resized: SpellSlots = {};
  for (const [key, target] of Object.entries(table)) {
    const level = Number(key);
    const current = slots[level];
    resized[level] =
      current === undefined
        ? target
        : ResourcePool.overdraftable(current, `Ячеек ${level} уровня`)
            .resized(target.maximum)
            .toState();
  }
  return resized;
}

export function spellSlotsForLevel(wizardLevel: number): SpellSlots {
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

export const CAST_MODES = ["normal", "ritual", "cantrip"] as const;

export type CastMode = (typeof CAST_MODES)[number];

export const RITUAL_EXTRA_MINUTES = 10;

export function consumesSlot(spellLevel: number, mode: CastMode): boolean {
  if (spellLevel === CANTRIP_LEVEL) return false;
  return mode === "normal";
}

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

export function castableSlotLevels(slots: SpellSlots, spellLevel: number): number[] {
  if (spellLevel === CANTRIP_LEVEL) return [];
  assertSlotLevel(spellLevel);
  return Object.keys(slots)
    .map(Number)
    .filter((level) => level >= spellLevel)
    .sort((left, right) => left - right);
}

export function restoreAllSlots(slots: SpellSlots): SpellSlots {
  const restored: SpellSlots = {};
  for (const [level, slot] of Object.entries(slots)) {
    restored[Number(level)] = { ...slot, remaining: slot.maximum };
  }
  return restored;
}

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

export type SlotRecoveryPlan = Record<number, number>;

type RecoveryValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function arcaneRecoveryPlanCost(plan: SlotRecoveryPlan): number {
  return Object.entries(plan).reduce((total, [level, count]) => total + Number(level) * count, 0);
}

type SlotInOrder = {
  level: number;
  maximum: number;
  remaining: number;
  spent: number;
};

export function slotsInOrder(slots: SpellSlots): SlotInOrder[] {
  return Object.entries(slots)
    .map(([level, slot]) => ({
      level: Number(level),
      ...slot,
      spent: slot.maximum - slot.remaining,
    }))
    .sort((left, right) => left.level - right.level);
}

export function recoverableSlots(slots: SpellSlots): SlotInOrder[] {
  return slotsInOrder(slots).filter(
    (slot) => slot.level <= ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL && slot.spent > 0,
  );
}

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

const MAXIMUM_BLOOD_SLOT_LEVEL = 5;

const SLOT_LEVEL_PRICES: Readonly<Record<number, number>> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

const ASCENSION_TIERS: readonly { readonly upToLevel: number; readonly hitPointsPerUnit: number }[] = [
  { upToLevel: 4, hitPointsPerUnit: 2 },
  { upToLevel: 8, hitPointsPerUnit: 3 },
  { upToLevel: 12, hitPointsPerUnit: 4 },
  { upToLevel: 16, hitPointsPerUnit: 5 },
  { upToLevel: 20, hitPointsPerUnit: 6 },
];

export function slotLevelPrice(castLevel: number): number {
  const price = SLOT_LEVEL_PRICES[castLevel];
  if (price === undefined) {
    throw new DomainError(
      `Кровь создаёт только ячейки уровней 1…${MAXIMUM_BLOOD_SLOT_LEVEL}, получено: ${castLevel}`,
    );
  }
  return price;
}

function ascensionTierRate(level: number): number {
  const tier =
    Number.isInteger(level) && level >= MINIMUM_CHARACTER_LEVEL
      ? ASCENSION_TIERS.find((candidate) => level <= candidate.upToLevel)
      : undefined;
  if (tier === undefined) {
    throw new DomainError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
  return tier.hitPointsPerUnit;
}

export function bloodSlotCost(castLevel: number, characterLevel: number): number {
  return slotLevelPrice(castLevel) * ascensionTierRate(characterLevel);
}

export function bloodSlotLevels(slots: SpellSlots, spellLevel: number): number[] {
  return castableSlotLevels(slots, spellLevel).filter(
    (level) => level <= MAXIMUM_BLOOD_SLOT_LEVEL,
  );
}

export function hasSlotLevel(slots: SpellSlots, slotLevel: number): boolean {
  return slots[slotLevel] !== undefined;
}

export function noSlotLevelRu(slotLevel: number): string {
  return `Ячеек ${slotLevel} уровня у персонажа нет`;
}
