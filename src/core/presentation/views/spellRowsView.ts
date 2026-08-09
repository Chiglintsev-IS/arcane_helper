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

import type { CastingView, SpellRowView, TurnView } from "@/contract/views";

import type { CharacterState } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { combatRoleOf } from "@/core/domain/catalog/combatRole";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import { benefitsFromHigherSlot, effectiveDamage } from "@/core/domain/catalog/scaling";
import type { Spell } from "@/core/domain/catalog/spell";
import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import { castInstructions, renderAnnouncement } from "@/core/application/casting/announcement";
import {
  bestCastPlan,
  castableInSituation,
  isSpellReady,
  ritualAvailable,
  slotPriceOf,
  type CastOption,
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
 * Почему заклинание сейчас недоступно, одной фразой; ничего — доступно.
 *
 * Способ спрашивается один и тот же, что и у мастера применения: взять причину у произвольного
 * способа значило бы соврать — неподготовленный ритуал объяснялся бы подготовкой.
 */
function unavailableReason(plan: ReturnType<typeof bestCastPlan>): string | undefined {
  if (plan === null) return "нет доступного способа сотворения";
  return plan.availability.warnings[0]?.reasonRu;
}

/** Каким станет Класс Доспеха, если сотворить: у заклинания без вклада в защиту — ничем. */
function armorClassIfCast(spell: Spell, character: CharacterState): number | undefined {
  if (spell.contributions.length === 0) return undefined;
  return Character.of(character).sheetWith(spell).value("armorClass");
}

function spellRowView(spell: Spell, character: CharacterState, turn: TurnEconomy): SpellRowView {
  const plan = bestCastPlan(spell, character, turn);
  const reason = unavailableReason(plan);
  const announcementContext = { character, ...(plan?.option ?? fallbackOption(spell)) };
  const announcement = renderAnnouncement(spell, announcementContext);
  const armorClass = armorClassIfCast(spell, character);

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
    instructions: castInstructions(spell, announcementContext),
    announcement: {
      text: announcement.text,
      gaps: announcement.gaps.map((gap) => ({
        ...(gap.placeholder === undefined ? {} : { placeholder: gap.placeholder }),
        reasonRu: gap.reasonRu,
      })),
    },
  };
}

export function toTurnView(live: LiveSession): TurnView {
  const { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable } =
    deriveTurnEconomy(live.session);
  return { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable };
}

export function toCastingView(character: CharacterState): CastingView {
  const sheet = Character.of(character).sheet;
  return {
    spellAttackModifier: sheet.value("spellAttackModifier"),
    spellSaveDc: sheet.value("spellSaveDc"),
    spellcastingModifier: sheet.abilityModifier(SPELLCASTING_ABILITY),
    preparedLimit: sheet.value("preparedLimit"),
    preparedCount: character.preparedSpellIds.length,
  };
}

export function toSpellRowViews(live: LiveSession): SpellRowView[] {
  const { character } = live.session;
  const turn = deriveTurnEconomy(live.session);
  return live.spellCatalog.map((spell) => spellRowView(spell, character, turn));
}
