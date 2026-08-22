/**
 * Способы сотворить заклинание и выбор лучшего из них.
 *
 * Вердикт «доступно» и объяснение «почему нет» обязаны приходить из одного способа: строка списка и
 * мастер применения называют одну причину, иначе приложению перестают верить.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  checkAvailability,
  turnResourceFor,
  type Availability,
  type PaymentChoice,
  type TurnResources,
} from "@/core/application/casting/availability";
import { payableCastLevels } from "@/core/domain/arcana/slots";
import { castableSlotLevels, type CastMode } from "@/core/domain/arcana/slots";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";

/** Ритуальный способ существует только вне боя: он занимает на десять минут больше обычного. */
export function ritualAvailable(spell: Pick<Spell, "ritual">, inFight: boolean): boolean {
  return spell.ritual === true && !inFight;
}

/** Готово ли заклинание к сотворению без подготовки: заговоры — всегда, прочее — по книге. */
export function isSpellReady(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL || Character.of(character).spellbook.isPrepared(spell.id);
}

/**
 * Творится ли заклинание внутри хода.
 *
 * Граница проходит по времени накладывания, а не по «боевому» смыслу: «Починка» за минуту в бою не
 * успевает независимо от того, насколько она полезна. Ровно те виды времени, которые тратят ресурс
 * хода, — второго перечня для этого не заводится.
 */
function castableWithinTurn(spell: Pick<Spell, "castingTime">): boolean {
  return turnResourceFor(spell.castingTime.type) !== undefined;
}

/**
 * Может ли персонаж сотворить заклинание в этой обстановке.
 *
 * Вне боя это заговоры, подготовленные и ритуальные записи книги: ритуал творится из книги без
 * подготовки. С началом боя ритуальный способ исчезает, и неподготовленный ритуал становится
 * несотворимым вовсе — ячейкой его не сотворить; остаётся только то, что укладывается в ход.
 */
export function castableInSituation(
  spell: Spell,
  character: CharacterState,
  inFight: boolean,
): boolean {
  const ready = isSpellReady(spell, character);
  if (inFight) return ready && castableWithinTurn(spell);
  return ready || ritualAvailable(spell, inFight);
}

/**
 * Цена сотворения в уровнях ячейки: самый дешёвый способ прямо сейчас, ноль — ячейка не нужна.
 *
 * Вне боя ритуал стоит ноль: ритуальный способ ячейки не требует. С началом боя он из перечня
 * способов уходит, и то же заклинание стоит свой уровень. Повышаемое стоит наименьший уровень, а не
 * наибольший: платить больше — выбор игрока, а не цена.
 */
export function slotPriceOf(spell: Spell, inFight: boolean): number {
  if (spell.level === CANTRIP_LEVEL) return 0;
  return ritualAvailable(spell, inFight) ? 0 : spell.level;
}

/** Способ сотворения: режим плюс оплата. */
export type CastOption = {
  mode: CastMode;
  payment: PaymentChoice;
};

/**
 * Все способы сотворить заклинание: ячейки от собственного уровня и выше, оплата кровью на каждом
 * уровне тарифа и ритуальный режим. Наличие свободной ячейки и запас крови здесь не проверяются —
 * это дело проверки доступности.
 *
 * В бою ритуального способа среди них нет: ритуал занимает на десять минут больше обычного, а раунд
 * длится шесть секунд. Предлагать его в бою значит предлагать выбор, который нельзя сделать.
 */
function castOptions(
  spell: Spell,
  character: CharacterState,
  options: { inCombat: boolean },
): CastOption[] {
  if (spell.level === CANTRIP_LEVEL) {
    return [{ mode: "cantrip", payment: { kind: "none" } }];
  }

  const plans: CastOption[] = castableSlotLevels(character.spellSlots, spell.level).map(
    (slotLevel) => ({ mode: "normal", payment: { kind: "slot", slotLevel } }),
  );

  // Кровью платят за каждый уровень, до которого дотягивается тариф: она повышает сотворение так
  // же, как ячейка старшего уровня, и Торну открывает пятый — тот, до чьих ячеек он не дорос.
  for (const castLevel of payableCastLevels(spell.level)) {
    plans.push({ mode: "normal", payment: { kind: "spell_points", castLevel } });
  }
  if (ritualAvailable(spell, options.inCombat)) {
    plans.push({ mode: "ritual", payment: { kind: "none" } });
  }
  return plans;
}

/** Способ сотворения вместе с его проверкой доступности. */
export type CastPlan = { option: CastOption; availability: Availability };

/** Способы сотворения и предложенный среди них. Предложенный всегда один из перечисленных. */
export type CastPlans = { all: [CastPlan, ...CastPlan[]]; suggested: CastPlan };

/**
 * Способ, которому мешает меньше всего: доступный, если он есть, иначе с наименьшим числом
 * предупреждений.
 *
 * Взять причину у произвольного способа значило бы соврать: неподготовленный ритуал объяснялся бы
 * подготовкой, хотя ритуалу она не нужна и мастер применения предложит именно ритуал.
 */
function leastHindered(first: CastPlan, rest: readonly CastPlan[]): CastPlan {
  let best = first;
  for (const plan of [first, ...rest]) {
    if (plan.availability.available) return plan;
    if (plan.availability.warnings.length < best.availability.warnings.length) best = plan;
  }
  return best;
}

/**
 * Все способы сотворить заклинание вместе с тем, что каждому мешает, и с предложенным среди них.
 *
 * Проверены все, а не только предложенный: ячейкой третьего заклинание сотворится, а вторым — нет,
 * и один вердикт на всю строку не отвечает ни на один вопрос игрока. `null` — способов нет вовсе:
 * заклинание уровня, до которого персонаж не дорос.
 */
export function castPlans(
  spell: Spell,
  character: CharacterState,
  turn: TurnResources,
): CastPlans | null {
  const [first, ...rest] = castOptions(spell, character, { inCombat: turn.inFight }).map(
    (option) => ({ option, availability: checkAvailability({ spell, character, turn, ...option }) }),
  );
  if (first === undefined) return null;
  return { all: [first, ...rest], suggested: leastHindered(first, rest) };
}
