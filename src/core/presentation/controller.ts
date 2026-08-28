/**
 * Контроллер: перевод команды договора в вызов сценария.
 *
 * Единственное место, где внешний язык встречается с внутренним. Сценарии живут в словаре
 * предметной области — принимают карточку заклинания и сессию; команда приносит идентификаторы и
 * строки. Перевод стоит здесь, поэтому вторая версия договора однажды поглотится тоже здесь, не
 * задев ни одного сценария.
 *
 * Слово, пришедшее строкой, сужает владелец списка — тем же перечнем, которым пользуется сам.
 * Составное значение сужает объявление своего контекста и отказывает с причиной. Второй проверки
 * здесь нет: она разошлась бы с настоящей при первой же правке правил, и молча.
 */

import type { Command } from "@/contract/commands";

import type { CharacterState } from "@/core/domain/assembly/state";
import { characterStatePatchSchema } from "@/core/domain/assembly/state";
import { RUNE_TARGETS } from "@/core/domain/arcana/runes";
import { CONCENTRATION_ENDS } from "@/core/domain/effects/effectBoard";
import { ITEM_KINDS, itemDefinitionOf } from "@/core/domain/items/schema";
import { moneyOf } from "@/core/domain/equipment/schema";
import { recipeFormulaOf } from "@/core/domain/crafting/recipe";
import { revealedPropertyOf } from "@/core/domain/crafting/schema";
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
  forgetIngredient,
  markPropertiesExhausted,
  noteIngredient,
  revealProperty,
  setWorkshop,
} from "@/core/application/useCases/crafting";
import {
  endConcentration,
  endEffect,
  setArmorClassAdjustment,
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

import { castModeOf, oneOf, runeOf, spellOf } from "./words";

/** Чем контроллер располагает помимо самой сессии: содержимое сборки. */
type ControllerParts = {
  builtInCatalog: readonly Spell[];
  createInitialCharacter: () => CharacterState;
};

/** Уровни ячеек приезжают ключами объекта, а ключ объекта — всегда строка. */
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

/** Владения навыками правимой характеристики: и навык, и степень — слова закрытых списков. */
function skillsOf(skills: Readonly<Record<string, string>>): Partial<Record<SkillId, SkillTraining>> {
  const trained: Partial<Record<SkillId, SkillTraining>> = {};
  for (const [skill, training] of Object.entries(skills)) {
    const id = oneOf(SKILL_IDS, skill, "навык");
    Object.assign(trained, { [id]: oneOf(SKILL_TRAINING, training, "владение навыком") });
  }
  return trained;
}

/**
 * Файл обмена из присланного текста.
 *
 * Разбирает его та же проверка, что читает собственный контент, и она же называет причину отказа:
 * второй разбор на стороне просящего принял бы то, чего эта не принимает, — и молча.
 */
function exportFileOf(raw: string): ExportFile {
  const parsed = parseImport(raw);
  if (!parsed.ok) throw new DomainError(parsed.reasonRu);
  return parsed.file;
}

/**
 * Начинает ли команда состояние заново.
 *
 * Знание живёт рядом с переводом команд: словарь команд — его предмет. Такой команде прежнее
 * состояние не нужно ни для чего, и требовать его значило бы запереть игрока в непрочитанном
 * сохранении — единственном месте, где начать заново и просят всерьёз.
 */
export function startsOver(command: Command): boolean {
  return command.kind === "reset";
}

/**
 * Применение команды. Отказ по правилам вылетает исключением владельца и становится ответом выше;
 * здесь его не ловят — решать, что делать с отказом, не дело перевода.
 *
 * Повтор узнаётся до применения: та же попытка, доставленная дважды, оставляет сессию как есть.
 */
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
          { nameRu: command.nameRu, kind: oneOf(ITEM_KINDS, command.itemKind, "категория вещи") },
          occasion,
        ),
      );
    case "edit_item":
      return changed(editItem(session, itemDefinitionOf(command.item), occasion));
    case "remove_item":
      return changed(removeItem(session, command.itemId, occasion));
    case "adjust_bag_count":
      return changed(adjustBagCount(session, command.itemId, command.delta, occasion));
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
    case "forget_ingredient":
      return changed(forgetIngredient(session, command.nameRu, occasion));
    case "mark_properties_exhausted":
      return changed(
        markPropertiesExhausted(
          session,
          { nameRu: command.nameRu, exhausted: command.exhausted },
          occasion,
        ),
      );
    case "reveal_property":
      return changed(
        revealProperty(
          session,
          {
            nameRu: command.nameRu,
            property: revealedPropertyOf({
              number: command.number,
              nameRu: command.propertyRu,
              rarity: command.rarity,
            }),
          },
          occasion,
        ),
      );

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
