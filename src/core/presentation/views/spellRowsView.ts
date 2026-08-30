import type {
  CastOptionView,
  CastingView,
  SpellCardView,
  SpellRowView,
  TurnView,
} from "@/contract/views";

import type { CharacterState } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { RITUAL_EXTRA_MINUTES } from "@/core/domain/arcana/slots";
import { combatRoleOf } from "@/core/domain/catalog/combatRole";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import { benefitsFromHigherSlot, effectiveDamage } from "@/core/domain/catalog/scaling";
import { CANTRIP_LEVEL, DAMAGE_PLACEHOLDER, needsOwnComponent, type ListCard, type Spell } from "@/core/domain/catalog/spell";
import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import {
  bloodPrice,
  castLevelOf,
  checkAvailability,
  closesWholeTurn,
  componentRequirements,
} from "@/core/application/casting/availability";
import { materialCoveredByFocus, materialOf } from "@/core/application/casting/material";
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

import { toDiagramView } from "./diagramView";

function fallbackOption(spell: Spell): CastOption {
  return { mode: "normal", payment: { kind: "slot", slotLevel: spell.level } };
}

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

function unavailableReason(suggested: CastPlan): string | undefined {
  return suggested.availability.warnings[0]?.reasonRu;
}

function ownUnavailableReason(suggested: CastPlan): string | undefined {
  const warning = suggested.availability.warnings[0];
  if (warning === undefined || closesWholeTurn(warning)) return undefined;
  return warning.reasonRu;
}

function castLevel(spell: Spell, option: CastOption): number {
  return castLevelOf(option.payment) ?? spell.level;
}

function castOptionView(
  plan: CastPlan,
  plans: CastPlans,
  spell: Spell,
  character: CharacterState,
): CastOptionView {
  const { option } = plan;
  const price =
    option.payment.kind === "blood" ? bloodPrice(option.payment.castLevel, character) : null;

  const level = castLevelOf(option.payment);

  return {
    mode: option.mode,
    payment: option.payment,
    ...(level === undefined ? {} : { castLevel: level }),
    suggested: plan === plans.suggested,
    available: plan.availability.available,
    warnings: plan.availability.warnings.map((warning) => ({
      code: warning.code,
      reasonRu: warning.reasonRu,
    })),
    ...(price === null ? {} : { hitPointCost: price.hitPoints }),
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
      : { reaction: { textRu: castingTime.reactionTrigger } }),
    components: {
      verbal: components.verbal,
      somatic: components.somatic,
      ...(components.materialText === undefined
        ? {}
        : {
            material: {
              textRu: components.materialText,
              consumed: components.consumed === true,
              ...(components.costGp === undefined ? {} : { costGp: components.costGp }),
            },
          }),
    },
    ...(spell.ritualDiagram === undefined
      ? {}
      : { ritualDiagram: toDiagramView(spell.ritualDiagram) }),
  };
}

function ownLevelDamage(spell: Spell, character: CharacterState): string | undefined {
  if (spell.damage === undefined) return undefined;
  return effectiveDamage(spell.damage, {
    spellLevel: spell.level,
    slotLevel: spell.level,
    characterLevel: character.level,
  });
}

function listCardView(card: ListCard, formula: string | undefined): NonNullable<SpellRowView["listCard"]> {
  const fill = (text: string): string =>
    formula === undefined ? text : text.replaceAll(DAMAGE_PLACEHOLDER, formula);
  const filled = (key: "effectLinesRu" | "hitLinesRu" | "failLinesRu" | "successLinesRu") => {
    const lines = card[key];
    return lines === undefined ? {} : { [key]: lines.map(fill) };
  };
  return {
    whereRu: fill(card.whereRu),
    ...(card.costMaterialRu === undefined ? {} : { costMaterialRu: card.costMaterialRu }),
    ...filled("effectLinesRu"),
    ...(card.rollSubjectRu === undefined ? {} : { rollSubjectRu: card.rollSubjectRu }),
    ...(card.rollNoteRu === undefined ? {} : { rollNoteRu: card.rollNoteRu }),
    ...filled("hitLinesRu"),
    ...filled("failLinesRu"),
    ...filled("successLinesRu"),
    ...(card.noteRu === undefined ? {} : { noteRu: fill(card.noteRu) }),
  };
}

function armorClassIfCast(spell: Spell, character: CharacterState): number | undefined {
  if (spell.contributions.length === 0) return undefined;
  return Character.of(character).sheetWith(spell).value("armorClass");
}

function spellRowView(spell: Spell, character: CharacterState, turn: TurnEconomy): SpellRowView {
  const plans = plansFor(spell, character, turn);
  const [first, ...rest] = plans.all;
  const reason = unavailableReason(plans.suggested);
  const ownReason = ownUnavailableReason(plans.suggested);
  const armorClass = armorClassIfCast(spell, character);
  const note = character.spellNotes[spell.id];
  const material = materialOf(spell.components);
  const materialCovered = materialCoveredByFocus(spell.components, character);
  const damageFormula = ownLevelDamage(spell, character);

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
    ownComponentCarried:
      material !== undefined && Character.of(character).equipment.carries(material.id),
    materialCoveredByFocus: materialCovered,
    role: combatRoleOf(spell),

    slotPrice: slotPriceOf(spell, turn.inFight),
    benefitsFromHigherSlot: benefitsFromHigherSlot(spell),
    ritualAvailable: ritualAvailable(spell, turn.inFight),
    prepared: isSpellReady(spell, character),
    castableNow: castableInSituation(spell, character, turn.inFight),
    unavailable: reason !== undefined,
    ...(ownReason === undefined ? {} : { unavailableReason: ownReason }),
    active: character.activeEffects.some((effect) => effect.spellId === spell.id),
    ...(damageFormula === undefined || spell.damage === undefined
      ? {}
      : { damage: { formula: damageFormula, type: spell.damage.type } }),
    ...(armorClass === undefined ? {} : { armorClassIfCast: armorClass }),
    castOptions: [
      castOptionView(first, plans, spell, character),
      ...rest.map((plan) => castOptionView(plan, plans, spell, character)),
    ],
    componentReminders: componentRequirements(spell.components, materialCovered),
    ...(note === undefined ? {} : { note }),
    ...(spell.listCard === undefined
      ? {}
      : { listCard: listCardView(spell.listCard, damageFormula) }),
    card: spellCardView(spell),
  };
}

export function toTurnView(live: LiveSession): TurnView {
  const { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable } =
    deriveTurnEconomy(live.session);
  return { round, inFight, actionAvailable, bonusActionAvailable, reactionAvailable };
}

export function toCastingView(character: CharacterState): CastingView {
  const { sheet, equipment, items } = Character.of(character);
  return {
    spellAttackModifier: sheet.value("spellAttackModifier"),
    spellSaveDc: sheet.value("spellSaveDc"),
    spellcastingModifier: sheet.abilityModifier(SPELLCASTING_ABILITY),
    preparedLimit: sheet.value("preparedLimit"),
    preparedCount: character.preparedSpellIds.length,
    ...(equipment.known ? { freeComponentsCovered: equipment.replacesFreeComponents(items) } : {}),
  };
}

export function knownSpells(live: LiveSession): Spell[] {
  const spellbook = Character.of(live.session.character).spellbook;
  return live.spellCatalog.filter((spell) => spellbook.knows(spell.id, spell.level));
}

export function toSpellRowViews(live: LiveSession): SpellRowView[] {
  const { character } = live.session;
  const turn = deriveTurnEconomy(live.session);
  return knownSpells(live).map((spell) => spellRowView(spell, character, turn));
}

export function toSpellsRefusal(live: LiveSession): string | undefined {
  const { character } = live.session;
  const turn = deriveTurnEconomy(live.session);

  for (const spell of knownSpells(live)) {
    const warning = plansFor(spell, character, turn).suggested.availability.warnings[0];
    if (warning !== undefined && closesWholeTurn(warning)) return warning.reasonRu;
  }
  return undefined;
}
