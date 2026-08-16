/**
 * Материал заклинания: вещь, которой оплачивается материальный компонент.
 *
 * Живёт в сотворении, а не в каталоге и не в вещах. Карточка называет компонент словами и про сумку
 * не знает; вещь не знает ни одного заклинания; свести их вправе только тот, кому нужны оба.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { needsOwnComponent, type Spell } from "@/core/domain/catalog/spell";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition, ItemKind } from "@/core/domain/items/schema";

/** Вещь компонента: чем зовётся в сумке, во что обходится и сгорает ли применением. */
type SpellMaterial = {
  id: string;
  nameRu: string;
  kind: ItemKind;
  price?: ItemDefinition["price"];
  consumed: boolean;
};

/**
 * Вещь, которой оплачивается компонент этой карточки; нет вовсе — материала заклинание не требует.
 *
 * Опознаётся словами карточки: один и тот же кусок шерсти, названный двумя заклинаниями одинаково,
 * остаётся одной вещью с одним запасом. Цену и судьбу вещь берёт оттуда же — приложение их не
 * выдумывает.
 */
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

/**
 * Закрыт ли компонент надетой фокусировкой или мешочком: закрытому не нужно ни проверки, ни слова.
 *
 * Названная стоимость и расход не закрываются ничем — такой компонент носят штучно, и спрашивают о
 * нём всегда.
 */
export function materialCoveredByFocus(
  components: Spell["components"],
  character: CharacterState,
): boolean {
  if (!components.material || needsOwnComponent(components)) return false;
  const root = Character.of(character);
  return root.equipment.replacesFreeComponents(root.items);
}

/** Кому нужна вещь: кто её требует, чем её заводят и срочно ли это. */
export type MaterialNeed = {
  /** Карточка, которой вещь заводят: цену и судьбу она называет сама. */
  spellId: string;
  material: NonNullable<ReturnType<typeof materialOf>>;
  /** Заклинания, называющие этот компонент, в порядке карточек. */
  spellNamesRu: string[];
  /** Закрыт ли компонент у этого персонажа: закрытый нужен, но не срочно. */
  coveredByFocus: boolean;
};

/**
 * Обход карточек: кому какая вещь нужна.
 *
 * Собирается здесь, а не хранится при вещи: вещь про своих потребителей не знает, и записанный при
 * ней перечень разошёлся бы с содержимым при первом же пополнении. Компонент одних и тех же слов у
 * двух карточек — одна вещь, и требуют её обе; срочным требование остаётся, пока его не закрыла
 * фокусировка хотя бы у одной из них.
 */
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
