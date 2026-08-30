import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { bloodSlotCost, slotsInOrder } from "@/core/domain/arcana/slots";
import type { RevealedProperty } from "@/core/domain/crafting/schema";

export function withSpentSlots(
  character: CharacterState,
  level: number,
  count: number,
): CharacterState {
  const root = Character.of(character);
  let arcana = root.arcana;
  for (let spent = 0; spent < count; spent += 1) {
    arcana = arcana.spendSlot(level);
  }
  return root.withArcana(arcana).toState();
}

export function withoutSlots(character: CharacterState): CharacterState {
  return slotsInOrder(character.spellSlots).reduce(
    (current, slot) => withSpentSlots(current, slot.level, slot.remaining),
    character,
  );
}

export function withSlotDebt(character: CharacterState, level: number): CharacterState {
  const drained = Character.of(withoutSlots(character));
  return drained.withArcana(drained.arcana.spendSlot(level, { allowOverdraft: true })).toState();
}

export function withDamage(character: CharacterState, damage: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.takeDamage(damage).vitality).toState();
}

export function withBloodPaid(character: CharacterState, castLevel: number): CharacterState {
  const root = Character.of(character);
  return root
    .withVitality(root.vitality.payWithBlood(bloodSlotCost(castLevel, root.base.level)))
    .toState();
}

export function withIngredientKnowledge(
  character: CharacterState,
  nameRu: string,
  properties: readonly RevealedProperty[] = [],
): CharacterState {
  const root = Character.of(character);
  return root
    .withCrafting(
      properties.reduce(
        (crafting, property) => crafting.revealProperty(nameRu, property),
        root.crafting.noteIngredient(nameRu),
      ),
    )
    .toState();
}

export function withoutRunes(character: CharacterState): CharacterState {
  const root = Character.of(character);
  let arcana = root.arcana;
  for (let spent = 0; spent < character.runes.remaining; spent += 1) {
    arcana = arcana.spendRune();
  }
  return root.withArcana(arcana).toState();
}

export function withoutLastHint(character: CharacterState): CharacterState {
  const root = Character.of(character);
  return root.withArcana(root.arcana.shiftLastHint(-character.lastHint.remaining)).toState();
}

export function withMasterReduction(character: CharacterState, amount: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.withMasterReduction(amount)).toState();
}

export function withSpentHitDice(character: CharacterState, count: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.spendHitDice(count)).toState();
}

export function withoutHitDice(character: CharacterState): CharacterState {
  const pool = character.hitDice;
  if (pool === undefined) return character;
  return withSpentHitDice(character, pool.remaining);
}

export function withForeignSlots(
  character: CharacterState,
  slots: CharacterState["spellSlots"],
): CharacterState {
  return { ...character, spellSlots: slots };
}

export function withoutComponentRecord(character: CharacterState): CharacterState {
  const { components: _unknown, ...equipment } = character.equipment;
  return { ...character, equipment };
}

export function withoutSpellcastingFocus(character: CharacterState): CharacterState {
  return Character.of(character)
    .items.all.filter((item) => item.spellcastingFocus === true)
    .reduce((state, focus) => {
      const root = Character.of(state);
      return root.withEquipment(root.equipment.unequip(focus.id, 1)).toState();
    }, character);
}

export function withoutArcaneRecovery(character: CharacterState): CharacterState {
  const budget = character.arcaneRecovery.remaining;
  if (budget === 0) return character;
  const root = Character.of(withSpentSlots(character, 1, budget));
  return root.withArcana(root.arcana.useArcaneRecovery({ 1: budget })).toState();
}

export function knowing(character: CharacterState, spellId: string): CharacterState {
  if (character.spellbookSpellIds.includes(spellId)) return character;
  return { ...character, spellbookSpellIds: [...character.spellbookSpellIds, spellId] };
}
