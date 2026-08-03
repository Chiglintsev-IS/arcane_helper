/**
 * Итоговый Класс Доспеха.
 *
 * Живёт у листа: формула принадлежит контексту, чьим словом назван результат. Эффекты итог не
 * считают — отдают вклады данными, и лист читает их из состояния, как любое другое слагаемое.
 *
 * Одна функция на все места, где число называется игроку: шапка боя, объявление мастеру и
 * карточка реакции. Расхождение этих чисел заставило бы перепроверять каждое.
 */

import { Sheet } from "./sheet";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import type { ArmorClassEffect, Spell } from "@/core/domain/catalog/spell";

/**
 * КД по слагаемым состояния и произвольному набору вкладов.
 *
 * Замены базы не суммируются — действует наибольшая, включая собственную базу персонажа: надетые
 * доспехи с базой выше 13 делают «Доспехи мага» бесполезными, и правило «работает только без
 * доспехов» получается из формулы само. Прибавки суммируются.
 */
function total(character: CharacterState, contributions: ArmorClassEffect[]): number {
  const { base, dexterityModifier, itemBonus } = Sheet.of(character).armorClassParts;

  const effectiveBase = contributions
    .filter((contribution) => contribution.kind === "base_override")
    .reduce((highest, contribution) => Math.max(highest, contribution.value), base);

  const bonuses = contributions
    .filter((contribution) => contribution.kind === "bonus")
    .reduce((sum, contribution) => sum + contribution.value, 0);

  return effectiveBase + dexterityModifier + itemBonus + bonuses;
}

/** Вклады активных эффектов: эффект без вклада к КД отношения не имеет. */
function contributionsOf(character: CharacterState): ArmorClassEffect[] {
  return character.activeEffects
    .map((effect) => effect.armorClass)
    .filter((contribution): contribution is ArmorClassEffect => contribution !== undefined);
}

/** Итоговый КД персонажа с учётом того, что действует прямо сейчас. */
export function effectiveArmorClass(character: CharacterState): number {
  return total(character, contributionsOf(character));
}

/** Активный эффект временной поправки к КД, заведённый шапкой ресурсов, если он есть. */
export function armorClassAdjustmentEffect(character: CharacterState): ActiveEffect | undefined {
  return character.activeEffects.find(
    (effect) => effect.manualKind === "armorAdjustment" && effect.armorClass !== undefined,
  );
}

/** Значение временной поправки к КД: 0, если она не заведена. */
export function armorClassAdjustment(character: CharacterState): number {
  return armorClassAdjustmentEffect(character)?.armorClass?.value ?? 0;
}

/**
 * КД, который получится, если сотворить заклинание: нужен объявлению мастеру до подтверждения,
 * когда эффекта ещё нет и состояние менять нельзя.
 *
 * Повторное применение того же заклинания вклад не удваивает: замена базы берётся наибольшей, а
 * прибавка второй раз не проходит — вклад того же заклинания уже учтён активным эффектом.
 */
export function armorClassWithSpell(character: CharacterState, spell: Spell): number {
  const { armorClassEffect } = spell;
  if (armorClassEffect === undefined) return effectiveArmorClass(character);

  const alreadyActive = character.activeEffects.some(
    (effect) => effect.spellId === spell.id && effect.armorClass !== undefined,
  );

  return total(
    character,
    alreadyActive ? contributionsOf(character) : [...contributionsOf(character), armorClassEffect],
  );
}
