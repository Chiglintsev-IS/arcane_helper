import type { ConcentrationCheckView, ConcentrationView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { effectiveDamage } from "@/core/domain/catalog/scaling";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  MINIMUM_CONCENTRATION_DC,
  checkOutcome,
  describeConcentrationCheck,
  durationWithRoundsRu,
  startRound,
} from "@/core/domain/effects/concentration";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import { saveStatId } from "@/core/domain/shared/stats";
import type { LiveSession, Session } from "@/core/application/session";

function unansweredDamage(session: Session): number | undefined {
  return session.log.at(-1)?.damage;
}

function checkView(damage: number, save: number): ConcentrationCheckView {
  const check = describeConcentrationCheck(damage, save);
  return {
    dc: check.dc,
    modifier: check.modifier,
    hasAdvantage: check.hasAdvantage,
    minimumRoll: check.minimumRoll,
    outcome: checkOutcome(check),
  };
}

function damageView(
  spell: Spell,
  effect: ActiveEffect,
  character: CharacterState,
): ConcentrationView["damage"] {
  if (spell.damage === undefined) return undefined;
  return {
    formula: effectiveDamage(spell.damage, {
      spellLevel: spell.level,
      slotLevel: effect.slotLevelUsed,
      characterLevel: character.level,
    }),
    type: spell.damage.type,
  };
}

export function toConcentrationView(live: LiveSession): ConcentrationView | undefined {
  const { session } = live;
  const { character } = session;
  const effect = character.activeEffects.find((candidate) => candidate.isConcentration);
  if (effect === undefined) return undefined;

  const spell = live.spellCatalog.find((candidate) => candidate.id === effect.spellId);
  const damage = spell === undefined ? undefined : damageView(spell, effect, character);
  const start = startRound(session.log, effect.startedAt);
  const save = Character.of(character).sheet.value(saveStatId("constitution"));
  const unanswered = unansweredDamage(session);

  return {
    ...(spell === undefined ? {} : { spellId: spell.id }),
    nameRu: effect.nameRu,
    slotLevelUsed: effect.slotLevelUsed,
    startedOnRound: start.round,
    startApproximate: start.approximate,
    durationRu: durationWithRoundsRu(effect.duration),
    shortRulesRu: spell?.shortRulesRu ?? effect.endConditionRu,
    ...(damage === undefined ? {} : { damage }),
    save,
    minimumDc: MINIMUM_CONCENTRATION_DC,
    ...(unanswered === undefined ? {} : { checkAfterDamage: checkView(unanswered, save) }),
  };
}
