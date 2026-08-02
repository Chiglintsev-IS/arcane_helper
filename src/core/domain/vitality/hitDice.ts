import { DomainError } from "@/core/domain/shared/errors";
import type { HitDiceCost } from "@/core/domain/catalog/spell";

export function hitDiceRegainedOnLongRest(total: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new DomainError(`Костей хитов должно быть хотя бы одна, получено ${total}`);
  }
  const half = Math.floor(total / 2);
  return Math.max(1, half);
}

function slotLevelsAboveSpell(slotLevel: number, spellLevel: number): number {
  return Math.max(0, slotLevel - spellLevel);
}

export function maximumHitDiceForCast(
  cost: HitDiceCost,
  spellLevel: number,
  slotLevel: number,
  remaining: number,
): number {
  const allowedByCost =
    cost.maximumDice + cost.extraDicePerSlotLevel * slotLevelsAboveSpell(slotLevel, spellLevel);
  return Math.min(allowedByCost, remaining);
}

/** Выпавшее на костях приходит от игрока: приложение кубики не бросает. */
export function hitDiceHealing(
  cost: HitDiceCost,
  rolled: number,
  spellcastingModifier: number,
): number {
  return rolled + (cost.addsSpellcastingModifier ? spellcastingModifier : 0);
}
