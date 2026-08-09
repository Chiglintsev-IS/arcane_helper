/**
 * Ответчик: вопрос договора — в предпросмотр.
 *
 * Отличается от контроллера тем, чего не делает: состояния не меняет, журнала не пишет, повтора не
 * ищет. Спросить дважды — то же самое, что спросить один раз, и обратимости здесь нечему касаться.
 *
 * Считает не сам: набранное отдаётся владельцу правила, и наружу уходит его ответ. Свой расчёт
 * разошёлся бы с тем, которым команда потом откажет или согласится.
 */

import type { Preview, PreviewOf, Question } from "@/contract/questions";

import { Character } from "@/core/domain/assembly/character";
import { affordableSpellLevels } from "@/core/domain/arcana/slots";
import { RUNES, runeEffect, runeUnavailability } from "@/core/domain/arcana/runes";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  hitDiceRollRange,
  hitDiceHealing,
  isPossibleHitDiceRoll,
  maximumHitDiceForCast,
} from "@/core/domain/vitality/hitDice";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import type { PaymentChoice } from "@/core/application/casting/availability";
import {
  bloodExchangeAnnouncement,
  bloodExchangeInstructions,
  bloodExchangePreview,
  castInstructions,
  renderAnnouncement,
} from "@/core/application/casting/announcement";
import type { LiveSession } from "@/core/application/session";
import { previewLevelChange } from "@/core/application/useCases/sheet";

import { castModeOf, runeOf, spellOf } from "./words";

type CastQuestion = Extract<Question, { kind: "cast_preview" }>;

/** Уровень, на котором сотворяется заклинание: выбранная ячейка или собственный уровень. */
function castLevel(spell: Spell, payment: PaymentChoice): number {
  return payment.kind === "slot" ? payment.slotLevel : spell.level;
}

/**
 * Кости хитов до броска: сколько позволено, что может выпасть и что вернётся.
 *
 * Диапазон появляется вместе с набранным числом костей, возможность и возврат — вместе с
 * набранным результатом: приложение кубики не бросает, но обязано отличить опечатку от броска.
 */
function hitDiceOf(
  spell: Spell,
  live: LiveSession,
  payment: PaymentChoice,
  count: number | undefined,
  rolled: number | undefined,
): PreviewOf<"cast_preview">["hitDice"] {
  const cost = spell.hitDiceCost;
  if (cost === undefined) return undefined;

  const { character } = live.session;
  const pool = character.hitDice;
  const maximum = maximumHitDiceForCast(
    cost,
    spell.level,
    castLevel(spell, payment),
    pool?.remaining ?? 0,
  );
  // Прибавка называется правилом заклинания, а не листом: не всякое сотворение её прибавляет.
  const spellcasting = Character.of(character).sheet.abilityModifier(SPELLCASTING_ABILITY);
  const modifier = hitDiceHealing(cost, 0, spellcasting);

  if (count === undefined || pool === undefined) return { maximum, modifier };

  const roll = hitDiceRollRange(count, pool.size);
  if (rolled === undefined) return { maximum, modifier, roll };

  return {
    maximum,
    modifier,
    roll,
    rollPossible: isPossibleHitDiceRoll(rolled, count, pool.size),
    restored: hitDiceHealing(cost, rolled, spellcasting),
  };
}

/**
 * Что даст каждая руна на выбранной ячейке и почему сейчас ни одной не приложить.
 *
 * Эффекты приезжают все три, а не только выбранный: игрок выбирает руну, читая, что каждая даст,
 * и посчитать половину уровня ячейки на экране значило бы завести второе правило о том же.
 */
function runesOf(live: LiveSession, payment: PaymentChoice): PreviewOf<"cast_preview">["runes"] {
  const { runes } = live.session.character;
  const unavailability = runeUnavailability(payment.kind === "slot", runes.remaining);

  return {
    effects: payment.kind === "slot"
      ? RUNES.map((rune) => ({ rune, effectRu: runeEffect(rune, payment.slotLevel) }))
      : [],
    ...(unavailability === null ? {} : { unavailabilityRu: unavailability }),
  };
}

function castPreview(live: LiveSession, question: CastQuestion): Preview {
  const { character } = live.session;
  const spell = spellOf(live.spellCatalog, question.spellId);
  const { payment } = question;
  const context = {
    character,
    mode: castModeOf(question.mode),
    payment,
    ...(question.targetLabel === undefined ? {} : { targetLabel: question.targetLabel }),
    ...(question.rune === undefined ? {} : { rune: runeOf(question.rune) }),
  };

  const announcement = renderAnnouncement(spell, context);
  const hitDice = hitDiceOf(spell, live, payment, question.hitDiceCount, question.hitDiceRolled);

  return {
    kind: "cast_preview",
    announcement: {
      text: announcement.text,
      gaps: announcement.gaps.map((gap) => ({
        ...(gap.placeholder === undefined ? {} : { placeholder: gap.placeholder }),
        reasonRu: gap.reasonRu,
      })),
    },
    instructions: castInstructions(spell, context),
    runes: runesOf(live, payment),
    ...(hitDice === undefined ? {} : { hitDice }),
  };
}

export function answerQuestion(live: LiveSession, question: Question): Preview {
  const { character } = live.session;

  if (question.kind === "health_preview") {
    return {
      kind: "health_preview",
      effectiveMaximum: Character.of(character).vitality.maximumWith({
        maximumBase: question.maximumBase,
        masterReduction: question.masterReduction,
      }),
    };
  }

  if (question.kind === "cast_preview") return castPreview(live, question);

  if (question.kind === "blood_exchange_preview") {
    const { points } = question;
    const exchange = bloodExchangePreview(points, character);
    return {
      kind: "blood_exchange_preview",
      ...exchange,
      affordableSpellLevel: affordableSpellLevels(exchange.pointsAfter).at(-1) ?? null,
      instructions: bloodExchangeInstructions(points, character),
      announcement: bloodExchangeAnnouncement(points, character),
    };
  }

  const { changes, hitPoints } = previewLevelChange(character, question.level);
  return {
    kind: "level_preview",
    changes: changes.map((change) => ({
      of: change.of,
      ...(change.of === "slots" ? { slotLevel: change.slotLevel } : {}),
      before: change.before,
      after: change.after,
    })),
    hitPoints,
  };
}
