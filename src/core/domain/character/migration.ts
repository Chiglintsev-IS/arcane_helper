/**
 * Приведение состояния прежней версии.
 *
 * Обновление приложения не имеет права терять данные, поэтому сохранение версии 1 читается, а не
 * отвергается. Прежние производные числа становятся перебивками: пока игрок не заполнит
 * характеристики, за столом действуют ровно те числа, что были, и на листе видно, что они введены
 * руками.
 */

import { DEFAULT_SCREEN_MODE } from "@/core/shared/screenMode";

const UNKNOWN_ABILITY_SCORE = 10;
/** База Класса Доспеха без доспехов. Нужна только на случай испорченного сохранения без неё. */
const DEFAULT_ARMOR_CLASS_BASE = 10;

type LegacyShape = {
  equipment?: { spellcastingFocus?: boolean; armorClassBase?: number };
  itemBonuses?: { spellcasting: number; armorClass: number; savingThrows: number };
  abilities?: unknown;
  intelligence?: number;
  spellSaveDc?: number;
  spellAttackModifier?: number;
  constitutionSaveModifier?: number;
  armorClass?: { base: number; dexterityModifier?: number; itemBonus?: number };
  hitPoints?: { current: number; maximum: number; maximumReduction: number };
};

/** Значение характеристики по модификатору: чётное, потому что 14 и 15 дают один и тот же +2. */
function scoreFor(modifier: number): number {
  return UNKNOWN_ABILITY_SCORE + modifier * 2;
}

/**
 * Версия 2 держала снаряжение плоским объектом с компонентами, а прибавки предметов и базу Класса
 * Доспеха — на листе персонажа. Теперь всё это принадлежит снаряжению.
 */
function migrateEquipment(state: LegacyShape, armorClassBase: number): unknown {
  const { equipment } = state;
  const known = equipment !== undefined && equipment.spellcastingFocus !== undefined;
  return {
    armorClassBase,
    otherBonuses: state.itemBonuses ?? { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [],
    ...(known ? { components: equipment } : {}),
  };
}

/** Режимы, слитые в «Игру»: бой перестал быть вкладкой и стал состоянием игры. */
const MERGED_SCREEN_MODES = new Set(["combat", "camp"]);

/**
 * Приведение режима идёт отдельно от формы состояния: сохранение свежей версии остальные шаги
 * пропускают, а закрыто оно могло быть на любом из прежних режимов.
 */
function migrateScreenMode(state: unknown): unknown {
  if (state === null || typeof state !== "object") return state;
  const { screenMode } = state as { screenMode?: unknown };
  if (typeof screenMode !== "string" || !MERGED_SCREEN_MODES.has(screenMode)) return state;
  return { ...state, screenMode: DEFAULT_SCREEN_MODE };
}

export function migrateCharacterState(raw: unknown): unknown {
  return migrateScreenMode(migrateShape(raw));
}

function migrateShape(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;

  const state = raw as LegacyShape;
  // Версия 3 узнаётся по снаряжению, знающему про базу защиты; версия 2 — по характеристикам.
  if ((state.equipment as { armorClassBase?: number } | undefined)?.armorClassBase !== undefined) {
    return raw;
  }

  if (state.abilities !== undefined) {
    const { itemBonuses: _moved, armorClass, ...rest } = state as LegacyShape & {
      armorClass?: { base: number };
    };
    return {
      ...rest,
      equipment: migrateEquipment(state, armorClass?.base ?? DEFAULT_ARMOR_CLASS_BASE),
    };
  }

  const { armorClass } = state;
  const dexterityModifier = armorClass?.dexterityModifier ?? 0;
  const itemBonus = armorClass?.itemBonus ?? 0;

  const {
    intelligence: _intelligence,
    spellSaveDc,
    spellAttackModifier,
    constitutionSaveModifier,
    ...rest
  } = state;

  return {
    ...rest,
    abilities: {
      strength: UNKNOWN_ABILITY_SCORE,
      dexterity: scoreFor(dexterityModifier),
      constitution: UNKNOWN_ABILITY_SCORE,
      intelligence: state.intelligence ?? UNKNOWN_ABILITY_SCORE,
      wisdom: UNKNOWN_ABILITY_SCORE,
      charisma: UNKNOWN_ABILITY_SCORE,
    },
    equipment: {
      armorClassBase: armorClass?.base ?? DEFAULT_ARMOR_CLASS_BASE,
      otherBonuses: { spellcasting: 0, armorClass: itemBonus, savingThrows: 0 },
      items: [],
      ...(state.equipment === undefined ? {} : { components: state.equipment }),
    },
    /** Один максимум распадается на базу и кровавое снижение: мастерского в версии 1 не было. */
    hitPoints:
      state.hitPoints === undefined
        ? state.hitPoints
        : {
            current: state.hitPoints.current,
            maximumBase: state.hitPoints.maximum + state.hitPoints.maximumReduction,
            bloodReduction: state.hitPoints.maximumReduction,
            masterReduction: 0,
          },
    overrides: {
      ...(spellSaveDc === undefined ? {} : { spellSaveDc }),
      ...(spellAttackModifier === undefined ? {} : { spellAttackModifier }),
      saves:
        constitutionSaveModifier === undefined ? {} : { constitution: constitutionSaveModifier },
      skills: {},
    },
  };
}
