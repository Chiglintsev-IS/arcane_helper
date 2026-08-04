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
import { hitPointsForPoints, slotsInOrder } from "@/core/domain/arcana/slots";

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

/** Обмен кровью: хиты и максимум падают, очки заклинаний появляются. Курс называет владелец. */
export function withBloodExchange(character: CharacterState, points: number): CharacterState {
  const root = Character.of(character);
  const { vitality } = root.vitality.exchangeBlood(
    hitPointsForPoints(points, root.base.level),
    points,
  );
  return root.withVitality(vitality).withArcana(root.arcana.gainSpellPoints(points)).toState();
}

/**
 * Максимум снижен кровью, а созданные очки уже израсходованы.
 *
 * Очки гаснут любым отмеченным часом, поэтому «были и кончились» — то же гашение, что за столом.
 */
export function withBloodSpent(character: CharacterState, points: number): CharacterState {
  const exchanged = Character.of(withBloodExchange(character, points));
  return exchanged.withArcana(exchanged.arcana.expireSpellPoints()).toState();
}

/** Очки заклинаний в запасе: их создаёт обмен кровью, других источников у них нет. */
export function withSpellPoints(character: CharacterState, points: number): CharacterState {
  const root = Character.of(character);
  return root.withArcana(root.arcana.gainSpellPoints(points)).toState();
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

/** Очки заклинаний истрачены сотворением: цену уровня называют ресурсы. */
export function withSpellPointsSpent(
  character: CharacterState,
  spellLevel: number,
): CharacterState {
  const root = Character.of(character);
  return root.withArcana(root.arcana.spendSpellPoints(spellLevel)).toState();
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
