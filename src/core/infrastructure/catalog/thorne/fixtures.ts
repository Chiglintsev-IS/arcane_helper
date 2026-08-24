/**
 * Состояния Торна для прогонов: игровые операции над состоянием, а не форма его полей.
 *
 * Фикстура, собранная словарём руками, повторяет правило и расходится с ним при первой же правке:
 * числа ячейки, хитов, рун и очков — дело своих контекстов, и в прогоне они меняются тем же путём,
 * что за столом. Заодно фикстура перестаёт молчать о причине: «истрачены три ячейки первого уровня»
 * читается, а `{ maximum: 4, remaining: 1 }` требует пересчёта в голове.
 *
 * Лежит рядом с самим Торном: это его состояния, а не общий инструмент.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { bloodSlotCost, slotsInOrder } from "@/core/domain/arcana/slots";
import type { RevealedProperty } from "@/core/domain/crafting/schema";

/** Столько-то ячеек уровня истрачено — как если бы их истратили сотворением. */
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

/** Свободных ячеек не осталось ни на одном уровне. */
export function withoutSlots(character: CharacterState): CharacterState {
  return slotsInOrder(character.spellSlots).reduce(
    (current, slot) => withSpentSlots(current, slot.level, slot.remaining),
    character,
  );
}

/**
 * Ячейка уровня списана в долг: свободных не осталось, а мастер разрешил сотворить всё равно.
 *
 * Состояние законное — долг виден остатком ниже нуля и возвращается отменой применения.
 */
export function withSlotDebt(character: CharacterState, level: number): CharacterState {
  const drained = Character.of(withoutSlots(character));
  return drained.withArcana(drained.arcana.spendSlot(level, { allowOverdraft: true })).toState();
}

/** Полученный урон: хиты падают тем же правилом, что и в бою. */
export function withDamage(character: CharacterState, damage: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.takeDamage(damage).vitality).toState();
}

/** Заплачено кровью за ячейку такого-то уровня: хиты и максимум упали. Цену называет владелец. */
export function withBloodPaid(character: CharacterState, castLevel: number): CharacterState {
  const root = Character.of(character);
  return root
    .withVitality(root.vitality.payWithBlood(bloodSlotCost(castLevel, root.base.level)))
    .toState();
}

/**
 * Про вид ингредиента узнано столько-то: вид записан, названные свойства раскрыты.
 *
 * Тем же путём, что за столом: сначала запись о виде, потом раскрытие по одному свойству — знание не
 * появляется целиком, и фикстура, положенная списком в поле, говорила бы обратное.
 */
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

/** Руны израсходованы «Знаками ограждения». */
export function withoutRunes(character: CharacterState): CharacterState {
  const root = Character.of(character);
  let arcana = root.arcana;
  for (let spent = 0; spent < character.runes.remaining; spent += 1) {
    arcana = arcana.spendRune();
  }
  return root.withArcana(arcana).toState();
}

/** Последняя подсказка истрачена: до долгого отдыха её больше нет. */
export function withoutLastHint(character: CharacterState): CharacterState {
  const root = Character.of(character);
  return root.withArcana(root.arcana.shiftLastHint(-character.lastHint.remaining)).toState();
}

/** Максимум понижен решением мастера: ту же правку делает лист персонажа. */
export function withMasterReduction(character: CharacterState, amount: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.withMasterReduction(amount)).toState();
}

/** Столько-то Костей хитов истрачено заклинанием, которое их тратит. */
export function withSpentHitDice(character: CharacterState, count: number): CharacterState {
  const root = Character.of(character);
  return root.withVitality(root.vitality.spendHitDice(count)).toState();
}

/** Костей хитов не осталось. */
export function withoutHitDice(character: CharacterState): CharacterState {
  const pool = character.hitDice;
  if (pool === undefined) return character;
  return withSpentHitDice(character, pool.remaining);
}

/**
 * Ячейка уровня, которого у персонажа быть не может, — и наоборот, состояние совсем без ячеек.
 *
 * Игра таких состояний не создаёт: они приходят чужой выгрузкой или испорченным сохранением.
 * Собираются здесь, а не в прогоне, чтобы «так не бывает» было сказано вслух и в одном месте.
 */
export function withForeignSlots(
  character: CharacterState,
  slots: CharacterState["spellSlots"],
): CharacterState {
  return { ...character, spellSlots: slots };
}

/**
 * Про снаряжение неизвестно ничего: записи о компонентах в состоянии нет вовсе.
 *
 * Игра такого состояния не создаёт: оно приходит выгрузкой из сборки, которая про компоненты не
 * знала. Вердикта о них в этом случае не бывает — «нечем закрыть» было бы выдумкой про чужого
 * персонажа.
 */
export function withoutComponentRecord(character: CharacterState): CharacterState {
  const { components: _unknown, ...equipment } = character.equipment;
  return { ...character, equipment };
}

/**
 * Фокусировка снята и лежит в сумке: ровно то, что делает с ней игрок, откладывая её.
 *
 * Снимается вещь, а не отметка: отметки о фокусировке не бывает — есть надетая вещь, и найти её
 * можно только спросив у вещей, какая из них фокусировка.
 */
export function withoutSpellcastingFocus(character: CharacterState): CharacterState {
  return Character.of(character)
    .items.all.filter((item) => item.spellcastingFocus === true)
    .reduce((state, focus) => {
      const root = Character.of(state);
      return root.withEquipment(root.equipment.unequip(focus.id, 1)).toState();
    }, character);
}

/**
 * Дневной бюджет магического восстановления израсходован целиком.
 *
 * Бюджет уходит только возвратом ячеек, поэтому сначала ячейки тратятся, а потом возвращаются им:
 * ячейки в итоге целы, а бюджета до долгого отдыха больше нет — ровно то состояние, в котором
 * восстановление отказывает.
 */
export function withoutArcaneRecovery(character: CharacterState): CharacterState {
  const budget = character.arcaneRecovery.remaining;
  if (budget === 0) return character;
  const root = Character.of(withSpentSlots(character, 1, budget));
  return root.withArcana(root.arcana.useArcaneRecovery({ 1: budget })).toState();
}

/**
 * Персонаж, знающий отложенное заклинание.
 *
 * Пул контента шире книги: стол откладывает запись, карточка остаётся, а приложение показывает
 * только знаемое. Прогону, которому нужен признак самой карточки — единственный оплачиваемый
 * компонент, скажем, — книга дописывается здесь, а не пересобирается в каждом прогоне заново.
 */
export function knowing(character: CharacterState, spellId: string): CharacterState {
  if (character.spellbookSpellIds.includes(spellId)) return character;
  return { ...character, spellbookSpellIds: [...character.spellbookSpellIds, spellId] };
}
