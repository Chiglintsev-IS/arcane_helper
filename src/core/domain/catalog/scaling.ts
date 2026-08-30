import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";

type DamageSpec = {
  dice: string;
  type: string;
  scaling?: Record<number, string> | undefined;
};

function damageAtSlotLevel(damage: DamageSpec, slotLevel: number): string {
  return damage.scaling?.[slotLevel] ?? damage.dice;
}

/** Ключи `scaling` — пороги уровня персонажа: в 5e это 5, 11 и 17. */
function cantripDamageAtCharacterLevel(damage: DamageSpec, characterLevel: number): string {
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

export function effectiveDamage(
  damage: DamageSpec,
  context: { spellLevel: number; slotLevel: number; characterLevel: number },
): string {
  return context.spellLevel === CANTRIP_LEVEL
    ? cantripDamageAtCharacterLevel(damage, context.characterLevel)
    : damageAtSlotLevel(damage, context.slotLevel);
}

export function benefitsFromHigherSlot(spell: {
  damage?: { scaling?: unknown } | undefined;
  higherLevelsRu?: string | undefined;
}): boolean {
  return spell.damage?.scaling !== undefined || spell.higherLevelsRu !== undefined;
}
