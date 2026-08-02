/**
 * Кости хитов.
 *
 * Ресурс лечения вне боя: их тратят коротким отдыхом и ими же платит «Мистическая бодрость».
 * Приложение их не бросает — бросок остаётся за столом, — но обязано знать, сколько
 * осталось: иначе игрок ведёт их на бумаге, а приложение говорит об отдыхе, ничего о нём не зная.
 *
 * Число костей выведено из правил, а не из документа расы: одна кость за уровень, размер задаёт
 * класс, у волшебника d6. Расовая надбавка «11 очков здоровья» на счёт костей не влияет, **если**
 * она надбавка к максимуму, а не замена кости — это и спрашивает
 * пунктом 3.
 */

import { DomainError } from "@/core/domain/shared/errors";
import type { HitDice } from "@/core/domain/character/state";
import type { HitDiceCost } from "@/core/domain/catalog/spell";

/**
 * Сколько костей возвращает долгий отдых: половина от всех, округляя вниз, но не меньше одной.
 *
 * Округление вниз — правило, а не осторожность: на нечётном числе костей персонаж не досчитывается
 * половины, и это часть цены за долгий бой.
 */
export function hitDiceRegainedOnLongRest(total: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new DomainError(`Костей хитов должно быть хотя бы одна, получено ${total}`);
  }
  return Math.max(1, Math.floor(total / 2));
}

/**
 * Остаток словами: «7d6», пока не потрачено ничего, и «5d6 из 7» после трат.
 *
 * Полная запись только при полном пуле: за столом «7d6» — это ответ на вопрос «чем лечиться», а
 * «7d6 из 7» заставляет сверять два одинаковых числа.
 */
export function hitDiceLabel(dice: HitDice | undefined): string {
  if (dice === undefined) return "не заведены";
  if (dice.remaining === dice.total) return `${dice.total}d${dice.size}`;
  return `${dice.remaining}d${dice.size} из ${dice.total}`;
}

/**
 * Сколько костей позволяет бросить заклинание.
 *
 * Максимум задаёт само заклинание полем `hitDiceCost`, а не движок: список заклинаний, тратящих
 * кости, ему не нужен. Остаток режет сверху — бросить больше, чем есть, нельзя.
 *
 * `Math.max(0, …)` не декоративен. В интерфейсе ячейку ниже уровня заклинания не выбрать, но схема
 * пользовательского импорта её не запрещает, а отрицательный множитель дал бы максимум
 * меньше базового.
 */
export function maximumHitDiceForCast(
  cost: HitDiceCost,
  spellLevel: number,
  slotLevel: number,
  remaining: number,
): number {
  const allowed =
    cost.maximumDice + cost.extraDicePerSlotLevel * Math.max(0, slotLevel - spellLevel);
  return Math.min(allowed, remaining);
}

/**
 * Сколько хитов вернёт бросок.
 *
 * Выпавшее приходит от игрока — приложение кубик не бросает, — а модификатор прибавляет
 * само и ровно один раз, сколько бы костей ни было брошено.
 */
export function hitDiceHealing(
  cost: HitDiceCost,
  rolled: number,
  spellcastingModifier: number,
): number {
  return rolled + (cost.addsSpellcastingModifier ? spellcastingModifier : 0);
}
