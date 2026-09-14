import type { Preview, PreviewOf, Question } from "@/contract/questions";

import { Character } from "@/core/domain/assembly/character";
import { arcaneRecoveryPlanCost, validateArcaneRecovery } from "@/core/domain/arcana/slots";
import {
  RUNES,
  RUNE_LABEL,
  runeChoosesTarget,
  runeEffect,
  runeUnavailability,
} from "@/core/domain/arcana/runes";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  hitDiceRollRange,
  hitDiceHealing,
  isPossibleHitDiceRoll,
  maximumHitDiceForCast,
} from "@/core/domain/vitality/hitDice";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import type { Batch } from "@/core/domain/crafting/batch";
import { ALCHEMY_ABILITY } from "@/core/domain/crafting/development";
import type { DevelopmentCheck } from "@/core/domain/crafting/development";
import { recipeFormulaOf } from "@/core/domain/crafting/recipe";
import { batchSpending, mixtureKinds } from "@/core/application/useCases/crafting";
import type { BatchSpending } from "@/core/application/useCases/crafting";
import type { PropertyMatch, RecipeDifficulty } from "@/core/domain/crafting/recipe";
import { refusalOf } from "@/core/domain/shared/errors";
import { castLevelOf, type PaymentChoice } from "@/core/application/casting/availability";
import { exportFileName, exportSnapshot } from "@/core/application/dataExchange";
import type { LiveSession } from "@/core/application/session";
import { previewLevelChange } from "@/core/application/useCases/sheet";

import { spellOf } from "./words";

type CastQuestion = Extract<Question, { kind: "cast_preview" }>;

function castLevel(spell: Spell, payment: PaymentChoice): number {
  return castLevelOf(payment) ?? spell.level;
}

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

function runesOf(live: LiveSession, payment: PaymentChoice): PreviewOf<"cast_preview">["runes"] {
  const { runes } = live.session.character;
  const level = castLevelOf(payment);
  const unavailability = runeUnavailability(level, runes.remaining);

  return {
    effects:
      level === undefined
        ? []
        : RUNES.map((rune) => ({
            rune,
            nameRu: RUNE_LABEL[rune],
            effectRu: runeEffect(rune, level),
            choosesTarget: runeChoosesTarget(rune),
          })),
    ...(unavailability === null ? {} : { unavailabilityRu: unavailability }),
  };
}

function castPreview(live: LiveSession, question: CastQuestion): Preview {
  const spell = spellOf(live.spellCatalog, question.spellId);
  const { payment } = question;
  const hitDice = hitDiceOf(spell, live, payment, question.hitDiceCount, question.hitDiceRolled);

  return {
    kind: "cast_preview",
    runes: runesOf(live, payment),
    ...(hitDice === undefined ? {} : { hitDice }),
  };
}

type RecipeQuestion = Extract<Question, { kind: "recipe_preview" }>;

function recipePreview(live: LiveSession, question: RecipeQuestion): Preview {
  const root = Character.of(live.session.character);
  const crafting = root.crafting;
  let matches: readonly PropertyMatch[] = [];
  let difficulty: RecipeDifficulty | null = null;
  let check: DevelopmentCheck | null = null;
  let batch: Batch | null = null;
  let known = false;
  let spend: readonly BatchSpending[] = [];
  let candidates: readonly { itemId: string; matchedRu: readonly string[] }[] = [];
  let refusalRu: string | undefined;

  try {
    const formula = recipeFormulaOf(question.formula);
    const chosen = mixtureKinds(root.items, formula.kinds);
    candidates = mixtureKinds(
      root.items,
      root.items.ingredients.map((item) => item.id),
    ).map((candidate) => ({
      itemId: candidate.id,
      matchedRu: crafting.joinsOf(chosen, candidate),
    }));
  } catch {
    candidates = [];
  }

  try {
    const formula = recipeFormulaOf(question.formula);
    const kinds = mixtureKinds(root.items, formula.kinds);
    spend = batchSpending(root, kinds, question.portions);
    matches = crafting.matches(kinds);
    known = crafting.knows(formula);
    difficulty = crafting.difficultyOf(kinds, formula, crafting.apparatus);
    check = crafting.checkFor({
      proficiencyBonus: root.sheet.value("proficiencyBonus"),
      abilityModifier: root.sheet.abilityModifier(ALCHEMY_ABILITY),
    });
    batch = crafting.batchOf(kinds, formula, crafting.apparatus, question.portions);
  } catch (error: unknown) {
    refusalRu = refusalOf(error);
  }

  return {
    kind: "recipe_preview",
    spend: spend.map((one) => ({ ...one })),
    candidates: candidates.map((one) => ({ itemId: one.itemId, matchedRu: [...one.matchedRu] })),
    matches: matches.map((match) => ({
      nameRu: match.nameRu,
      sources: [...match.sources],
      tier: match.tier,
    })),
    difficulty:
      difficulty === null
        ? null
        : {
            total: difficulty.total,
            parts: difficulty.parts.map((part) => ({ ...part })),
            mainRu: difficulty.mainRu,
          },
    batch:
      batch === null
        ? null
        : {
            minutes: batch.minutes,
            consumablesRu: batch.consumables.nameRu,
            goldPerStartedHour: batch.consumables.goldPerStartedHour,
            consumableKits: batch.consumableKits,
            consumablesGold: batch.consumablesGold,
            units: batch.units,
          },
    warnings: batch === null ? [] : batch.warnings.map((warning) => ({ ...warning })),
    noticesRu: difficulty === null ? [] : [...difficulty.noticesRu],
    check: check === null ? null : { bonus: check.bonus },
    known,
    ...(refusalRu === undefined ? {} : { refusalRu }),
  };
}

type ResearchQuestion = Extract<Question, { kind: "research_preview" }>;

function researchPreview(live: LiveSession, question: ResearchQuestion): Preview {
  const root = Character.of(live.session.character);
  const crafting = root.crafting;

  try {
    const [kind] = mixtureKinds(root.items, [question.itemId]);
    const plan = crafting.researchPlanFor(kind!, question.number);
    return {
      kind: "research_preview",
      plan: {
        minutes: plan.minutes,
        difficulty: plan.difficulty,
        portionsOnSuccess: plan.portionsOnSuccess,
        portionsOnFailure: plan.portionsOnFailure,
        consumablesRu: plan.consumablesRu,
        consumablesGold: plan.consumablesGold,
        rawSampleRu: plan.rawSampleRu,
        requirementRu: plan.requirementRu,
      },
    };
  } catch (error: unknown) {
    return { kind: "research_preview", plan: null, refusalRu: refusalOf(error) };
  }
}

export function answerQuestion(live: LiveSession, question: Question, now: string): Preview {
  const { character } = live.session;

  if (question.kind === "export_preview") {
    return {
      kind: "export_preview",
      fileName: exportFileName(now),
      text: JSON.stringify(exportSnapshot(character, live.spellCatalog, now), null, 2),
    };
  }

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

  if (question.kind === "recipe_preview") return recipePreview(live, question);

  if (question.kind === "research_preview") return researchPreview(live, question);

  if (question.kind === "arcane_recovery_preview") {
    const validation = validateArcaneRecovery(
      character.spellSlots,
      question.plan,
      character.arcaneRecovery.remaining,
    );
    return {
      kind: "arcane_recovery_preview",
      levelsSpent: arcaneRecoveryPlanCost(question.plan),
      ...(validation.valid ? {} : { unavailabilityRu: validation.reason }),
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
