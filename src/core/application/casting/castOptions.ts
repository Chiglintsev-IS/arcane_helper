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
import { bloodSlotLevels } from "@/core/domain/arcana/slots";
import { benefitsFromHigherSlot } from "@/core/domain/catalog/scaling";
import { castableSlotLevels, type CastMode } from "@/core/domain/arcana/slots";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";

export function ritualAvailable(spell: Pick<Spell, "ritual">, inFight: boolean): boolean {
  return spell.ritual === true && !inFight;
}

export function isSpellReady(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL || Character.of(character).spellbook.isPrepared(spell.id);
}

function castableWithinTurn(spell: Pick<Spell, "castingTime">): boolean {
  return turnResourceFor(spell.castingTime.type) !== undefined;
}

export function castableInSituation(
  spell: Spell,
  character: CharacterState,
  inFight: boolean,
): boolean {
  const ready = isSpellReady(spell, character);
  if (inFight) return ready && castableWithinTurn(spell);
  return ready || ritualAvailable(spell, inFight);
}

export function slotPriceOf(spell: Spell, inFight: boolean): number {
  if (spell.level === CANTRIP_LEVEL) return 0;
  return ritualAvailable(spell, inFight) ? 0 : spell.level;
}

function bloodLevels(spell: Spell, character: CharacterState): number[] {
  const levels = bloodSlotLevels(character.spellSlots, spell.level);
  return benefitsFromHigherSlot(spell) ? levels : levels.slice(0, 1);
}

export type CastOption = {
  mode: CastMode;
  payment: PaymentChoice;
};

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

  for (const castLevel of bloodLevels(spell, character)) {
    plans.push({ mode: "normal", payment: { kind: "blood", castLevel } });
  }
  if (ritualAvailable(spell, options.inCombat)) {
    plans.push({ mode: "ritual", payment: { kind: "none" } });
  }
  return plans;
}

export type CastPlan = { option: CastOption; availability: Availability };

export type CastPlans = { all: [CastPlan, ...CastPlan[]]; suggested: CastPlan };

function leastHindered(first: CastPlan, rest: readonly CastPlan[]): CastPlan {
  let best = first;
  for (const plan of [first, ...rest]) {
    if (plan.availability.available) return plan;
    if (plan.availability.warnings.length < best.availability.warnings.length) best = plan;
  }
  return best;
}

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
