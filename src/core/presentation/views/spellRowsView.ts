/**
 * Проекция списка заклинаний: карточка вместе с тем, чем она является для этого персонажа сейчас.
 *
 * Вердикт «доступно» и объяснение «почему нет» приходят отсюда оба и из одного способа сотворения:
 * пока их спрашивали порознь, строка списка и мастер применения называли разные причины одного
 * запрета, и приложению переставали верить.
 *
 * Обстановку проекция знает сама — по журналу, а не по вопросу извне: «идёт ли бой» выводит
 * схватка, и второй ответ на тот же вопрос разошёлся бы с ним молча.
 */

import type {
  CastOptionView,
  CastingView,
  SpellCardView,
  SpellRowView,
  TurnView,
} from "@/contract/views";

import type { CharacterState } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { hitPointCost, spellPointCost, RITUAL_EXTRA_MINUTES } from "@/core/domain/arcana/slots";
import { combatRoleOf } from "@/core/domain/catalog/combatRole";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import { benefitsFromHigherSlot, effectiveDamage } from "@/core/domain/catalog/scaling";
import { CANTRIP_LEVEL, needsOwnComponent, type Spell } from "@/core/domain/catalog/spell";
import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import { castInstructions, renderAnnouncement } from "@/core/application/casting/announcement";
import {
  checkAvailability,
  componentRequirements,
} from "@/core/application/casting/availability";
import {
  castPlans,
  castableInSituation,
  isSpellReady,
  ritualAvailable,
  slotPriceOf,
  type CastOption,
  type CastPlan,
  type CastPlans,
} from "@/core/application/casting/castOptions";
import type { LiveSession } from "@/core/application/session";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";

/**
 * Способ для заклинания, которое сотворить нечем вовсе: уровень, до ячеек которого персонаж не
 * дорос и который не оплачивается очками. Объявление обязано называть уровень и тогда — иначе
 * карточка молчит о том, ради чего её открыли. Заговоров это не касается: у них способ есть всегда.
 */
function fallbackOption(spell: Spell): CastOption {
  return { mode: "normal", payment: { kind: "slot", slotLevel: spell.level } };
}

/**
 * Способы сотворения этого заклинания и предложенный среди них.
 *
 * Пустым список не бывает: заклинание, которое сотворить нечем, называет тот способ, которым его
 * сотворяли бы, — иначе мастер применения открывается пустым и не объясняет, чего не хватает.
 */
function plansFor(spell: Spell, character: CharacterState, turn: TurnEconomy): CastPlans {
  const found = castPlans(spell, character, turn);
  if (found !== null) return found;

  const option = fallbackOption(spell);
  const only: CastPlan = {
    option,
    availability: checkAvailability({ spell, character, turn, ...option }),
  };
  return { all: [only], suggested: only };
}

/**
 * Почему заклинание сейчас недоступно, одной фразой; ничего — доступно.
 *
 * Причина берётся у предложенного способа — того же, который откроет мастер применения: взять её у
 * произвольного значило бы соврать, и неподготовленный ритуал объяснялся бы подготовкой.
 */
function unavailableReason(suggested: CastPlan): string | undefined {
  return suggested.availability.warnings[0]?.reasonRu;
}

/** Уровень, на котором сотворяется заклинание этим способом: выбранная ячейка или свой уровень. */
function castLevel(spell: Spell, option: CastOption): number {
  return option.payment.kind === "slot" ? option.payment.slotLevel : spell.level;
}

function castOptionView(
  plan: CastPlan,
  plans: CastPlans,
  spell: Spell,
  character: CharacterState,
): CastOptionView {
  const { option } = plan;
  const paidWithPoints = option.payment.kind === "spell_points";

  return {
    mode: option.mode,
    payment: option.payment,
    suggested: plan === plans.suggested,
    available: plan.availability.available,
    warnings: plan.availability.warnings.map((warning) => ({
      code: warning.code,
      reasonRu: warning.reasonRu,
    })),
    ...(paidWithPoints
      ? {
          spellPointCost: spellPointCost(spell.level),
          hitPointCost: hitPointCost(spell.level, character.level),
        }
      : {}),
    ...(option.mode === "ritual" ? { extraMinutes: RITUAL_EXTRA_MINUTES } : {}),
    ...(spell.damage === undefined
      ? {}
      : {
          damage: {
            formula: effectiveDamage(spell.damage, {
              spellLevel: spell.level,
              slotLevel: castLevel(spell, option),
              characterLevel: character.level,
            }),
            type: spell.damage.type,
          },
        }),
  };
}

/**
 * Карточка так, как её показывают: написанное о заклинании, без единого числа этого персонажа.
 *
 * Персонажа функция не принимает, и это не экономия параметра: карточка одна и та же у любого, кто
 * открыл книгу, а всё, что зависит от него, стоит в строке рядом.
 */
function spellCardView(spell: Spell): SpellCardView {
  const { castingTime, components, resolution, targeting } = spell;

  return {
    nameEn: spell.nameEn,
    school: spell.school,
    fullRulesRu: spell.fullRulesRu,
    ...(spell.higherLevelsRu === undefined ? {} : { higherLevelsRu: spell.higherLevelsRu }),
    ...(spell.tacticalAdviceRu === undefined ? {} : { tacticalAdviceRu: spell.tacticalAdviceRu }),
    targeting: {
      type: targeting.type,
      ...(targeting.maximumTargets === undefined
        ? {}
        : { maximumTargets: targeting.maximumTargets }),
    },
    ...(resolution.successEffect === undefined
      ? {}
      : { successEffectRu: resolution.successEffect }),
    ...(resolution.failureEffect === undefined
      ? {}
      : { failureEffectRu: resolution.failureEffect }),
    ...(castingTime.reactionTrigger === undefined
      ? {}
      : {
          reaction: {
            ...(castingTime.trigger === undefined ? {} : { trigger: castingTime.trigger }),
            textRu: castingTime.reactionTrigger,
          },
        }),
    ...(components.materialText === undefined
      ? {}
      : {
          material: { textRu: components.materialText, consumed: components.consumed === true },
        }),
    roleplay: { incantation: spell.roleplay.incantation, gesture: spell.roleplay.gesture },
  };
}

/** Каким станет Класс Доспеха, если сотворить: у заклинания без вклада в защиту — ничем. */
function armorClassIfCast(spell: Spell, character: CharacterState): number | undefined {
  if (spell.contributions.length === 0) return undefined;
  return Character.of(character).sheetWith(spell).value("armorClass");
}

function spellRowView(spell: Spell, character: CharacterState, turn: TurnEconomy): SpellRowView {
  const plans = plansFor(spell, character, turn);
  const [first, ...rest] = plans.all;
  const reason = unavailableReason(plans.suggested);
  const announcementContext = { character, ...plans.suggested.option };
  const announcement = renderAnnouncement(spell, announcementContext);
  const armorClass = armorClassIfCast(spell, character);
  const note = character.spellNotes[spell.id];

  return {
    id: spell.id,
    nameRu: spell.nameRu,
    shortRulesRu: spell.shortRulesRu,
    level: spell.level,
    castingTime: {
      type: spell.castingTime.type,
      ...(spell.castingTime.value === undefined ? {} : { value: spell.castingTime.value }),
    },
    range: {
      type: spell.range.type,
      ...(spell.range.distanceFeet === undefined ? {} : { distanceFeet: spell.range.distanceFeet }),
    },
    ...(spell.area === undefined
      ? {}
      : { area: { shape: spell.area.shape, sizeFeet: spell.area.sizeFeet } }),
    duration: {
      type: spell.duration.type,
      ...(spell.duration.value === undefined ? {} : { value: spell.duration.value }),
    },
    resolution: {
      type: spell.resolution.type,
      ...(spell.resolution.savingThrow === undefined
        ? {}
        : { savingThrow: spell.resolution.savingThrow }),
    },
    concentration: spell.concentration,
    ritual: spell.ritual,
    cantrip: spell.level === CANTRIP_LEVEL,
    spendsHitDice: spell.hitDiceCost !== undefined,
    ownComponentRequired: needsOwnComponent(spell.components),
    ownComponentCarried: Character.of(character).equipment.hasMaterialFor(spell.id),
    role: combatRoleOf(spell),

    slotPrice: slotPriceOf(spell, turn.inFight),
    benefitsFromHigherSlot: benefitsFromHigherSlot(spell),
    ritualAvailable: ritualAvailable(spell, turn.inFight),
    prepared: isSpellReady(spell, character),
    castableNow: castableInSituation(spell, character, turn.inFight),
    ...(reason === undefined ? {} : { unavailableReason: reason }),
    active: character.activeEffects.some((effect) => effect.spellId === spell.id),
    ...(spell.damage === undefined
      ? {}
      : {
          damage: {
            // Уровень ячейки — собственный уровень заклинания: строка называет цену, а не щедрость.
            formula: effectiveDamage(spell.damage, {
              spellLevel: spell.level,
              slotLevel: spell.level,
              characterLevel: character.level,
            }),
            type: spell.damage.type,
          },
        }),
    ...(armorClass === undefined ? {} : { armorClassIfCast: armorClass }),
    castOptions: [
      castOptionView(first, plans, spell, character),
      ...rest.map((plan) => castOptionView(plan, plans, spell, character)),
    ],
    componentReminders: componentRequirements(spell.components),
    instructions: castInstructions(spell, announcementContext),
    announcement: {
      text: announcement.text,
      gaps: announcement.gaps.map((gap) => ({
        ...(gap.placeholder === undefined ? {} : { placeholder: gap.placeholder }),
        reasonRu: gap.reasonRu,
      })),
    },
    ...(note === undefined ? {} : { note }),
    card: spellCardView(spell),
  };
}

export function toTurnView(live: LiveSession): TurnView {
  const { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable } =
    deriveTurnEconomy(live.session);
  return { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable };
}

export function toCastingView(character: CharacterState): CastingView {
  const { sheet, equipment } = Character.of(character);
  return {
    spellAttackModifier: sheet.value("spellAttackModifier"),
    spellSaveDc: sheet.value("spellSaveDc"),
    spellcastingModifier: sheet.abilityModifier(SPELLCASTING_ABILITY),
    preparedLimit: sheet.value("preparedLimit"),
    preparedCount: character.preparedSpellIds.length,
    // Незаведённое снаряжение вердикта не даёт: «нечем закрыть» было бы выдумкой про чужого
    // персонажа, чьё состояние приехало из сборки, которая про компоненты не знала.
    ...(equipment.known ? { freeComponentsCovered: equipment.replacesFreeComponents } : {}),
  };
}

export function toSpellRowViews(live: LiveSession): SpellRowView[] {
  const { character } = live.session;
  const turn = deriveTurnEconomy(live.session);
  return live.spellCatalog.map((spell) => spellRowView(spell, character, turn));
}
