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
import { UNARMORED_ARMOR_CLASS_BASE } from "@/core/domain/equipment/equipment";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "./abilities";

const UNKNOWN_ABILITY_SCORE = 10;

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
 * Хранимая база КД из снаряжения становится перебивкой листа.
 *
 * База, равная базе без доспехов, перебивкой не становится: это не выбор игрока, а умолчание.
 * Имя доспеха приведение не выдумывает — отличное от умолчания число честнее хранить перебивкой,
 * пока игрок не заведёт доспех сам.
 */
function migrateArmorBase(state: unknown): unknown {
  const split = splitArmorBase(state);
  if (split === null) return state;

  const overrides = (state as { overrides?: unknown }).overrides;
  const known =
    overrides !== null && typeof overrides === "object"
      ? (overrides as Record<string, unknown>)
      : {};
  const keepDerived =
    typeof split.base !== "number" ||
    split.base === UNARMORED_ARMOR_CLASS_BASE ||
    known.armorClassBase !== undefined;

  return {
    ...(state as Record<string, unknown>),
    equipment: split.equipment,
    ...(keepDerived ? {} : { overrides: { ...known, armorClassBase: split.base } }),
  };
}

/**
 * Снимок отмены хранимую базу просто теряет: перебивку из него не собрать — снимок не знает,
 * какие перебивки действовали в тот момент, а дописанная наугад затёрла бы чужие.
 */
function migrateArmorBasePatch(patch: unknown): unknown {
  const split = splitArmorBase(patch);
  if (split === null) return patch;
  return { ...(patch as Record<string, unknown>), equipment: split.equipment };
}

/** Снимает хранимую базу со снаряжения; `null` — приводить нечего. */
function splitArmorBase(
  state: unknown,
): { equipment: Record<string, unknown>; base: unknown } | null {
  if (state === null || typeof state !== "object") return null;
  const { equipment } = state as { equipment?: unknown };
  if (equipment === null || typeof equipment !== "object" || !("armorClassBase" in equipment)) {
    return null;
  }
  const { armorClassBase, ...bare } = equipment as Record<string, unknown>;
  return { equipment: bare, base: armorClassBase };
}

/**
 * «Прибавки без вещи» жили в снаряжении; теперь это прочие прибавки самого персонажа.
 *
 * Работает и над состоянием, и над снимком отмены: у обоих одна и та же пара «снаряжение —
 * персонаж», и снимок со старым полем возвращал бы прибавку туда, откуда она уехала.
 */
function migrateMiscBonuses(state: unknown): unknown {
  if (state === null || typeof state !== "object") return state;
  const { equipment, miscBonuses } = state as { equipment?: unknown; miscBonuses?: unknown };
  if (equipment === null || typeof equipment !== "object" || !("otherBonuses" in equipment)) {
    return state;
  }
  const { otherBonuses, ...rest } = equipment as Record<string, unknown>;
  return {
    ...state,
    equipment: rest,
    ...(miscBonuses === undefined ? { miscBonuses: otherBonuses } : {}),
  };
}

/**
 * Имя, которым прежние версии опознавали поправку к КД среди активных эффектов. Заморожено на дате
 * приведения: нынешняя подпись поправки вправе меняться, а прошлые сохранения — нет.
 */
const LEGACY_ADJUSTMENT_NAME_RU = "Поправка к КД";

/** Эффект прежней формы получает признак поправки: опознание по строке имени умерло. */
function migrateAdjustmentEffect(effect: unknown): unknown {
  if (effect === null || typeof effect !== "object") return effect;
  const { nameRu, armorClass, manualKind } = effect as {
    nameRu?: unknown;
    armorClass?: unknown;
    manualKind?: unknown;
  };
  if (nameRu !== LEGACY_ADJUSTMENT_NAME_RU || armorClass === undefined || manualKind !== undefined) {
    return effect;
  }
  return { ...(effect as Record<string, unknown>), manualKind: "armorAdjustment" };
}

function migrateAdjustmentMarker(state: unknown): unknown {
  if (state === null || typeof state !== "object") return state;
  const { activeEffects } = state as { activeEffects?: unknown };
  if (!Array.isArray(activeEffects)) return state;

  const effects = activeEffects.map(migrateAdjustmentEffect);
  if (effects.every((effect, index) => effect === activeEffects[index])) return state;
  return { ...state, activeEffects: effects };
}

/**
 * Приведение снимка отмены. Снимок держит прежние значения изменяемых полей, включая снаряжение
 * прежней формы; без приведения отмена старой записи вернула бы в состояние рода вещей, которых
 * новая модель не знает.
 */
export function migrateUndoPatch(patch: unknown): unknown {
  return migrateAdjustmentMarker(
    migrateArmorBasePatch(migrateMiscBonuses(migrateItemCategories(patch))),
  );
}

export function migrateCharacterState(raw: unknown): unknown {
  return migrateAdjustmentMarker(
    migrateArmorBase(
      migrateMiscBonuses(
        migrateItemCategories(migrateArcaneRecovery(migrateScreenMode(migrateShape(raw)))),
      ),
    ),
  );
}

function migrateShape(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;

  const state = raw as LegacyShape;
  // Версии 3 и 4 узнаются по снаряжению, знающему про инвентарь либо хранимую базу защиты;
  // версия 2 — по характеристикам.
  const equipment = state.equipment as { armorClassBase?: number; items?: unknown } | undefined;
  if (equipment?.armorClassBase !== undefined || equipment?.items !== undefined) {
    return raw;
  }

  if (state.abilities !== undefined) {
    const { itemBonuses: _moved, armorClass, ...rest } = state as LegacyShape & {
      armorClass?: { base: number };
    };
    return {
      ...rest,
      equipment: migrateEquipment(state, armorClass?.base ?? UNARMORED_ARMOR_CLASS_BASE),
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
      armorClassBase: armorClass?.base ?? UNARMORED_ARMOR_CLASS_BASE,
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
