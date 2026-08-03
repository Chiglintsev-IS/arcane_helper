/**
 * Приведение состояния прежней версии.
 *
 * Обновление приложения не имеет права терять данные, поэтому сохранение версии 1 читается, а не
 * отвергается. Прежние производные числа становятся перебивками: пока игрок не заполнит
 * характеристики, за столом действуют ровно те числа, что были, и на листе видно, что они введены
 * руками.
 */

import { DEFAULT_SCREEN_MODE } from "@/core/shared/screenMode";
import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "./abilities";

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

/**
 * Признак «доступно/потрачено» становится бюджетом уровней ячеек: старое значение переносится без
 * потерь, потому что оба его состояния — ровно полный бюджет или ровно нулевой остаток.
 */
function migrateArcaneRecovery(state: unknown): unknown {
  if (state === null || typeof state !== "object") return state;
  const { arcaneRecoveryAvailable, arcaneRecovery, level } = state as {
    arcaneRecoveryAvailable?: unknown;
    arcaneRecovery?: unknown;
    level?: unknown;
  };
  if (arcaneRecovery !== undefined || typeof arcaneRecoveryAvailable !== "boolean") return state;

  const maximum =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= MINIMUM_CHARACTER_LEVEL &&
    level <= MAXIMUM_CHARACTER_LEVEL
      ? arcaneRecoveryBudget(level)
      : 0;

  const { arcaneRecoveryAvailable: _omitted, ...rest } = state as Record<string, unknown>;
  return { ...rest, arcaneRecovery: { maximum, remaining: arcaneRecoveryAvailable ? maximum : 0 } };
}

/** Прежние рода вещей, у которых в четырёх категориях есть прямой наследник. */
const LEGACY_ITEM_KINDS: Record<string, string> = { potion: "consumable", junk: "other" };

/** Верхний предел счёта вещи — тот же, что в схеме; сюда продублирован против цикла импортов. */
const ITEM_COUNT_CAP = 9999;

/**
 * Одна вещь прежней формы — к новой: род становится категорией (зелье — расходник, хлам —
 * «другое», без рода — по поведению: надетая или с прибавкой была экипировкой и до слова),
 * надетость вне экипировки снимается — расходник не бывает надет, — а счёт выше предела
 * обрезается пределом: старая схема потолка не знала, и отказ схемы запирал бы всё сохранение.
 */
function migrateItem(item: unknown): unknown {
  if (item === null || typeof item !== "object") return item;
  const { kind, worn, bonuses, count } = item as {
    kind?: unknown;
    worn?: unknown;
    bonuses?: unknown;
    count?: unknown;
  };

  const migratedKind =
    kind === "gear" || kind === "consumable" || kind === "ingredient" || kind === "other"
      ? kind
      : typeof kind === "string" && kind in LEGACY_ITEM_KINDS
        ? LEGACY_ITEM_KINDS[kind]
        : worn === true || bonuses !== undefined
          ? "gear"
          : "other";

  const wornOff = migratedKind !== "gear" && worn === true;
  const capped = typeof count === "number" && count > ITEM_COUNT_CAP;
  if (migratedKind === kind && !wornOff && !capped) return item;

  return {
    ...(item as Record<string, unknown>),
    kind: migratedKind,
    ...(wornOff ? { worn: false } : {}),
    ...(capped ? { count: ITEM_COUNT_CAP } : {}),
  };
}

function migrateItemCategories(state: unknown): unknown {
  if (state === null || typeof state !== "object") return state;
  const { equipment } = state as { equipment?: { items?: unknown } };
  const stored = equipment?.items;
  if (!Array.isArray(stored)) return state;

  const items = stored.map(migrateItem);
  // Свежее состояние проходит насквозь той же ссылкой: приведение не пересобирает приведённое.
  if (items.every((item, index) => item === stored[index])) return state;
  return { ...state, equipment: { ...equipment, items } };
}

/**
 * Приведение снимка отмены. Снимок держит прежние значения изменяемых полей, включая снаряжение
 * прежней формы; без приведения отмена старой записи вернула бы в состояние рода вещей, которых
 * новая модель не знает.
 */
export function migrateUndoPatch(patch: unknown): unknown {
  return migrateItemCategories(patch);
}

export function migrateCharacterState(raw: unknown): unknown {
  return migrateItemCategories(migrateArcaneRecovery(migrateScreenMode(migrateShape(raw))));
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
