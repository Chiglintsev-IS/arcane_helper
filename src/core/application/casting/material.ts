import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { needsOwnComponent, type Spell } from "@/core/domain/catalog/spell";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition, ItemKind } from "@/core/domain/items/schema";

type SpellMaterial = {
  id: string;
  nameRu: string;
  kind: ItemKind;
  price?: ItemDefinition["price"];
  consumed: boolean;
};

export function materialOf(components: Spell["components"]): SpellMaterial | undefined {
  const { material, materialText, costGp, consumed } = components;
  if (!material || materialText === undefined) return undefined;

  const price: ItemDefinition["price"] =
    costGp === undefined ? undefined : { amount: costGp, currency: "gold" };
  return {
    id: Items.idFromName(materialText),
    nameRu: materialText,
    kind: consumed === true ? "consumable" : "other",
    consumed: consumed === true,
    ...(price === undefined ? {} : { price }),
  };
}

export function materialCoveredByFocus(
  components: Spell["components"],
  character: CharacterState,
): boolean {
  if (!components.material || needsOwnComponent(components)) return false;
  const root = Character.of(character);
  return root.equipment.replacesFreeComponents(root.items);
}

export type MaterialNeed = {
  spellId: string;
  material: NonNullable<ReturnType<typeof materialOf>>;
  spellNamesRu: string[];
  coveredByFocus: boolean;
};

export function materialNeeds(
  spells: readonly Spell[],
  character: CharacterState,
): MaterialNeed[] {
  const needs = new Map<string, MaterialNeed>();

  for (const spell of spells) {
    const material = materialOf(spell.components);
    if (material === undefined) continue;

    const covered = materialCoveredByFocus(spell.components, character);
    const known = needs.get(material.id);
    if (known === undefined) {
      needs.set(material.id, {
        spellId: spell.id,
        material,
        spellNamesRu: [spell.nameRu],
        coveredByFocus: covered,
      });
      continue;
    }

    known.spellNamesRu.push(spell.nameRu);
    known.coveredByFocus = known.coveredByFocus && covered;
  }

  return [...needs.values()];
}
