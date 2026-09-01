import type { Command } from "@/contract/commands";

import type { CharacterState } from "@/core/domain/assembly/state";
import { characterStatePatchSchema } from "@/core/domain/assembly/state";
import { RUNE_TARGETS } from "@/core/domain/arcana/runes";
import { CONCENTRATION_ENDS } from "@/core/domain/effects/effectBoard";
import { ITEM_KINDS, itemDefinitionOf } from "@/core/domain/items/schema";
import { moneyOf } from "@/core/domain/equipment/schema";
import { recipeFormulaOf } from "@/core/domain/crafting/recipe";
import { revealedPropertyOf } from "@/core/domain/items/ingredient";
import type { Spell } from "@/core/domain/catalog/spell";
import { ABILITIES, SKILL_IDS, type SkillId } from "@/core/domain/shared/stats";
import { SKILL_TRAINING, type SkillTraining } from "@/core/domain/character/skills";
import { DomainError } from "@/core/domain/shared/errors";

import { applyImport, parseImport, type ExportFile } from "@/core/application/dataExchange";
import {
  alreadyApplied,
  createSession,
  replaceCharacter,
  undoLast,
  type LiveSession,
  type Occasion,
  type Session,
} from "@/core/application/session";
import { castSpell } from "@/core/application/useCases/casting";
import {
  craftBatch,
  dropObservation,
  nameRarity,
  markPropertiesExhausted,
  noteIngredient,
  noteObservation,
  revealProperty,
  rewriteObservation,
  setWorkshop,
} from "@/core/application/useCases/crafting";
import {
  endConcentration,
  endEffect,
  setArmorClassAdjustment,
  spendRuneOnAnimalSpeech,
  spendRuneOnWardingSigil,
  startManualEffect,
} from "@/core/application/useCases/effects";
import {
  addItem,
  adjustBagCount,
  adjustWornCount,
  editItem,
  editMoney,
  removeItem,
  recordItem,
  setBagCount,
  toggleWanted,
} from "@/core/application/useCases/equipment";
import {
  grantTemporaryHitPoints,
  heal,
  recoverHitPointMaximum,
  setSunlight,
  takeDamage,
} from "@/core/application/useCases/health";
import { setSpellNote, toggleMaterial, togglePreparation } from "@/core/application/useCases/library";
import { addWorldNote, editWorldNote, removeWorldNote } from "@/core/application/useCases/notes";
import {
  adjustLastHint,
  adjustRunes,
  refundSpellSlot,
  spendSpellSlot,
} from "@/core/application/useCases/resources";
import { longRest, shortRest, useArcaneRecovery } from "@/core/application/useCases/rest";
import {
  changeLevel,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  identityOf,
} from "@/core/application/useCases/sheet";
import { beginTurn, endCombat, startCombat } from "@/core/application/useCases/turn";

import { castModeOf, oneOf, rarityOf, runeOf, spellOf } from "./words";

type ControllerParts = {
  builtInCatalog: readonly Spell[];
  createInitialCharacter: () => CharacterState;
};

function slotPlanOf(plan: Readonly<Record<string, number>>): Record<number, number> {
  const levels: Record<number, number> = {};
  for (const [level, count] of Object.entries(plan)) {
    const parsed = Number(level);
    if (!Number.isInteger(parsed)) {
      throw new DomainError(`Не годится уровень ячейки — «${level}» не целое число`);
    }
    levels[parsed] = count;
  }
  return levels;
}

function skillsOf(skills: Readonly<Record<string, string>>): Partial<Record<SkillId, SkillTraining>> {
  const trained: Partial<Record<SkillId, SkillTraining>> = {};
  for (const [skill, training] of Object.entries(skills)) {
    const id = oneOf(SKILL_IDS, skill, "навык");
    Object.assign(trained, { [id]: oneOf(SKILL_TRAINING, training, "владение навыком") });
  }
  return trained;
}

function exportFileOf(raw: string): ExportFile {
  const parsed = parseImport(raw);
  if (!parsed.ok) throw new DomainError(parsed.reasonRu);
  return parsed.file;
}

export function startsOver(command: Command): boolean {
  return command.kind === "reset";
}

export function applyCommand(
  live: LiveSession,
  command: Command,
  occasion: Occasion,
  parts: ControllerParts,
): LiveSession {
  const { session, spellCatalog } = live;
  if (alreadyApplied(session, occasion.commandId)) return live;

  const changed = (next: Session): LiveSession => ({ ...live, session: next });

  switch (command.kind) {
    case "cast_spell":
      return changed(
        castSpell(
          session,
          {
            spell: spellOf(spellCatalog, command.spellId),
            mode: castModeOf(command.mode),
            payment: command.payment,
            ...(command.rune === undefined ? {} : { rune: runeOf(command.rune) }),
            ...(command.runeTarget === undefined
              ? {}
              : { runeTarget: oneOf(RUNE_TARGETS, command.runeTarget, "цель руны") }),
            ...(command.allowAnyway === undefined ? {} : { allowAnyway: command.allowAnyway }),
            ...(command.replaceConcentration === undefined
              ? {}
              : { replaceConcentration: command.replaceConcentration }),
            ...(command.hitDice === undefined ? {} : { hitDice: command.hitDice }),
          },
          occasion,
        ),
      );

    case "start_combat":
      return changed(startCombat(session, occasion));
    case "begin_turn":
      return changed(beginTurn(session, occasion));
    case "end_combat":
      return changed(endCombat(session, occasion));

    case "end_concentration":
      return changed(
        endConcentration(
          session,
          oneOf(CONCENTRATION_ENDS, command.reason, "причина конца концентрации"),
          occasion,
        ),
      );
    case "spend_rune_on_warding_sigil":
      return changed(spendRuneOnWardingSigil(session, occasion));
    case "spend_rune_on_animal_speech":
      return changed(spendRuneOnAnimalSpeech(session, occasion));
    case "start_manual_effect":
      return changed(
        startManualEffect(
          session,
          {
            nameRu: command.nameRu,
            ...(command.armorClassBonus === undefined
              ? {}
              : { armorClassBonus: command.armorClassBonus }),
          },
          occasion,
        ),
      );
    case "set_armor_class_adjustment":
      return changed(setArmorClassAdjustment(session, command.value, occasion));
    case "end_effect":
      return changed(endEffect(session, command.effectId, occasion));

    case "adjust_runes":
      return changed(adjustRunes(session, command.delta, occasion));
    case "adjust_last_hint":
      return changed(adjustLastHint(session, command.delta, occasion));
    case "spend_spell_slot":
      return changed(spendSpellSlot(session, command.slotLevel, occasion));
    case "refund_spell_slot":
      return changed(refundSpellSlot(session, command.slotLevel, occasion));

    case "take_damage":
      return changed(
        takeDamage(
          session,
          command.damage,
          occasion,
          command.fire === undefined ? {} : { fire: command.fire },
        ),
      );
    case "heal":
      return changed(heal(session, command.amount, occasion));
    case "grant_temporary_hit_points":
      return changed(grantTemporaryHitPoints(session, command.amount, occasion));
    case "recover_hit_point_maximum":
      return changed(recoverHitPointMaximum(session, occasion));
    case "set_sunlight":
      return changed(setSunlight(session, command.underSunlight, occasion));

    case "long_rest":
      return changed(longRest(session, occasion));
    case "short_rest":
      return changed(shortRest(session, occasion));
    case "use_arcane_recovery":
      return changed(useArcaneRecovery(session, slotPlanOf(command.plan), occasion));

    case "toggle_preparation":
      return changed(togglePreparation(session, spellOf(spellCatalog, command.spellId), occasion));
    case "toggle_material":
      return changed(toggleMaterial(session, spellOf(spellCatalog, command.spellId), occasion));
    case "set_spell_note":
      return changed(setSpellNote(session, command.spellId, command.note));

    case "add_world_note":
      return changed(addWorldNote(session, command.text, occasion));
    case "edit_world_note":
      return changed(editWorldNote(session, command.noteId, command.text));
    case "remove_world_note":
      return changed(removeWorldNote(session, command.noteId));

    case "add_item":
      return changed(
        addItem(
          session,
          {
            nameRu: command.nameRu,
            kinds: command.itemKinds.map((kind) => oneOf(ITEM_KINDS, kind, "признак вещи")),
          },
          occasion,
        ),
      );
    case "edit_item":
      return changed(editItem(session, itemDefinitionOf(command.item), occasion));
    case "remove_item":
      return changed(removeItem(session, command.itemId, occasion));
    case "toggle_wanted":
      return changed(toggleWanted(session, command.itemId, occasion));
    case "record_item":
      return changed(recordItem(session, command.nameRu, command.wanted, occasion));
    case "adjust_bag_count":
      return changed(adjustBagCount(session, command.itemId, command.delta, occasion));
    case "set_bag_count":
      return changed(setBagCount(session, command.itemId, command.count, occasion));
    case "adjust_worn_count":
      return changed(adjustWornCount(session, command.itemId, command.delta, occasion));
    case "edit_money":
      return changed(editMoney(session, moneyOf(command.money), occasion));

    case "craft_batch":
      return changed(
        craftBatch(
          session,
          {
            formula: recipeFormulaOf(command.formula),
            portions: command.portions,
            rolled: command.rolled,
            mishapRolled: command.mishapRolled,
            risky: command.risky,
          },
          occasion,
        ),
      );

    case "note_ingredient":
      return changed(noteIngredient(session, command.nameRu, occasion));
    case "mark_properties_exhausted":
      return changed(
        markPropertiesExhausted(
          session,
          { itemId: command.itemId, exhausted: command.exhausted },
          occasion,
        ),
      );
    case "reveal_property":
      return changed(
        revealProperty(
          session,
          {
            itemId: command.itemId,
            property: revealedPropertyOf({
              number: command.number,
              nameRu: command.propertyRu,
            }),
            ...(command.rarity === undefined ? {} : { rarity: rarityOf(command.rarity) }),
          },
          occasion,
        ),
      );
    case "name_rarity":
      return changed(
        nameRarity(
          session,
          { propertyRu: command.propertyRu, rarity: rarityOf(command.rarity) },
          occasion,
        ),
      );

    case "note_observation":
      return changed(noteObservation(session, command.itemId, command.textRu, occasion));
    case "rewrite_observation":
      return changed(
        rewriteObservation(session, command.itemId, command.observationId, command.textRu),
      );
    case "drop_observation":
      return changed(dropObservation(session, command.itemId, command.observationId));

    case "set_alchemy_workshop":
      return changed(
        setWorkshop(
          session,
          {
            alchemyApparatus: command.apparatus,
            studiedDirections: command.studiedDirections,
          },
          occasion,
        ),
      );

    case "edit_identity":
      return changed(
        editIdentity(session, identityOf(characterStatePatchSchema.parse(command.patch))),
      );
    case "edit_ability":
      return changed(
        editAbility(
          session,
          {
            ability: oneOf(ABILITIES, command.ability, "характеристика"),
            score: command.score,
            saveProficient: command.saveProficient,
            skills: skillsOf(command.skills),
          },
          occasion,
        ),
      );
    case "edit_marks":
      return changed(
        editMarks(
          session,
          { exhaustion: command.exhaustion, inspiration: command.inspiration },
          occasion,
        ),
      );
    case "edit_health":
      return changed(
        editHealth(
          session,
          { maximumBase: command.maximumBase, masterReduction: command.masterReduction },
          occasion,
        ),
      );
    case "change_level":
      return changed(
        changeLevel(
          session,
          { level: command.level, hitPointMaximumBase: command.hitPointMaximumBase },
          occasion,
        ),
      );

    case "undo_last":
      return changed(undoLast(session));

    case "import_snapshot": {
      const { character, spells } = applyImport(
        session.character,
        exportFileOf(command.raw),
        "replace",
      );
      return {
        session: replaceCharacter(character),
        spellCatalog: spells,
        spellCatalogSource: "imported",
      };
    }

    case "restore_built_in_catalog":
      return { session, spellCatalog: parts.builtInCatalog, spellCatalogSource: "built_in" };

    case "reset":
      return {
        session: createSession(parts.createInitialCharacter()),
        spellCatalog: parts.builtInCatalog,
        spellCatalogSource: "built_in",
      };
  }
}
