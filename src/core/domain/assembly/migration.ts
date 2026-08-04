/**
 * Приведение состояния прежней версии.
 *
 * Обновление приложения не имеет права терять данные, поэтому сохранение версии 1 читается, а не
 * отвергается. Прежние производные числа становятся перебивками: пока игрок не заполнит
 * характеристики, за столом действуют ровно те числа, что были, и на листе видно, что они введены
 * руками.
 */

import { z } from "zod";

import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { isStateField } from "@/core/domain/assembly/state";
import { UNARMORED_ARMOR_CLASS_BASE } from "@/core/domain/equipment/equipment";
import {
  filledGearOnlyFields,
  MAXIMUM_ITEM_COUNT,
  withoutGearOnlyFields,
} from "@/core/domain/equipment/schema";
import { fieldsOf } from "@/core/domain/shared/fields";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";

const UNKNOWN_ABILITY_SCORE = 10;

const NO_LEGACY_BONUSES = { spellcasting: 0, armorClass: 0, savingThrows: 0 };

/**
 * Прежние формы объявлены, а не обещаны: приведение читает числа, поэтому числами они и обязаны
 * быть. Объявления открытые — всё, чего прежние версии не меняли, проходит сквозь них как есть.
 */
const legacyArmorClass = z.looseObject({
  base: z.number(),
  dexterityModifier: z.number().optional(),
  itemBonus: z.number().optional(),
});

/** Версия 1 держала один максимум хитов и снижение кровью отдельным числом. */
const versionOneShape = z.looseObject({
  intelligence: z.number().optional(),
  spellSaveDc: z.number().optional(),
  spellAttackModifier: z.number().optional(),
  constitutionSaveModifier: z.number().optional(),
  armorClass: legacyArmorClass.optional(),
  hitPoints: z
    .looseObject({ current: z.number(), maximum: z.number(), maximumReduction: z.number() })
    .optional(),
  equipment: z.unknown().optional(),
});

/** Версия 2 узнаётся по характеристикам: снаряжение у неё плоское, а прибавки лежат у персонажа. */
const versionTwoShape = z.looseObject({
  abilities: z.unknown().optional(),
  itemBonuses: z.unknown().optional(),
  armorClass: z.looseObject({ base: z.number() }).optional(),
  equipment: z.looseObject({ spellcastingFocus: z.boolean().optional() }).optional(),
});

/** Значение характеристики по модификатору: чётное, потому что 14 и 15 дают один и тот же +2. */
function scoreFor(modifier: number): number {
  return UNKNOWN_ABILITY_SCORE + modifier * 2;
}

/**
 * Версия 2 держала снаряжение плоским объектом с компонентами, а прибавки предметов и базу Класса
 * Доспеха — на листе персонажа. Теперь всё это принадлежит снаряжению.
 */
function migrateEquipment(state: z.infer<typeof versionTwoShape>, armorClassBase: number): unknown {
  const { equipment } = state;
  const known = equipment !== undefined && equipment.spellcastingFocus !== undefined;
  return {
    armorClassBase,
    otherBonuses: state.itemBonuses ?? NO_LEGACY_BONUSES,
    items: [],
    ...(known ? { components: equipment } : {}),
  };
}

/**
 * Признак «доступно/потрачено» становится бюджетом уровней ячеек: старое значение переносится без
 * потерь, потому что оба его состояния — ровно полный бюджет или ровно нулевой остаток.
 */
function migrateArcaneRecovery(state: unknown): unknown {
  const fields = fieldsOf(state);
  const { arcaneRecoveryAvailable, arcaneRecovery, level } = fields;
  if (arcaneRecovery !== undefined || typeof arcaneRecoveryAvailable !== "boolean") return state;

  const maximum =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= MINIMUM_CHARACTER_LEVEL &&
    level <= MAXIMUM_CHARACTER_LEVEL
      ? arcaneRecoveryBudget(level)
      : 0;

  const { arcaneRecoveryAvailable: _omitted, ...rest } = fields;
  return { ...rest, arcaneRecovery: { maximum, remaining: arcaneRecoveryAvailable ? maximum : 0 } };
}

/** Прежние рода вещей, у которых в четырёх категориях есть прямой наследник. */
const LEGACY_ITEM_KINDS: Record<string, string> = { potion: "consumable", junk: "other" };

/**
 * Одна вещь прежней формы — к новой: род становится категорией (зелье — расходник, хлам —
 * «другое», без рода — по поведению: заполненное свойство экипировки выдаёт экипировку и до слова),
 * свойства экипировки вне экипировки снимаются — прежняя сборка позволяла надеть зелье и дать ему
 * прибавку, — а счёт выше предела обрезается пределом: старая схема потолка не знала, и отказ схемы
 * запирал бы всё сохранение.
 *
 * Какие свойства принадлежат экипировке, знает её объявление, а не приведение: перечислить их здесь
 * своим списком значило бы снимать не то, что отвергает схема.
 */
function migrateItem(item: unknown): unknown {
  if (item === null || typeof item !== "object") return item;
  const fields = fieldsOf(item);
  const { kind, count } = fields;
  const gearOnly = filledGearOnlyFields(fields);

  const migratedKind =
    kind === "gear" || kind === "consumable" || kind === "ingredient" || kind === "other"
      ? kind
      : typeof kind === "string" && kind in LEGACY_ITEM_KINDS
        ? LEGACY_ITEM_KINDS[kind]
        : gearOnly.length > 0
          ? "gear"
          : "other";

  const gearOnlyOff = migratedKind !== "gear" && gearOnly.length > 0;
  const capped = typeof count === "number" && count > MAXIMUM_ITEM_COUNT;
  if (migratedKind === kind && !gearOnlyOff && !capped) return item;

  return {
    ...(gearOnlyOff ? withoutGearOnlyFields(fields) : fields),
    kind: migratedKind,
    ...(capped ? { count: MAXIMUM_ITEM_COUNT } : {}),
  };
}

function migrateItemCategories(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const stored = equipment.items;
  if (!Array.isArray(stored)) return state;

  const items = stored.map(migrateItem);
  // Свежее состояние проходит насквозь той же ссылкой: приведение не пересобирает приведённое.
  if (items.every((item, index) => item === stored[index])) return state;
  return { ...fields, equipment: { ...equipment, items } };
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

  const fields = fieldsOf(state);
  const known = fieldsOf(fields.overrides);
  const keepDerived =
    typeof split.base !== "number" ||
    split.base === UNARMORED_ARMOR_CLASS_BASE ||
    known.armorClassBase !== undefined;

  return {
    ...fields,
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
  return { ...fieldsOf(patch), equipment: split.equipment };
}

/** Снимает хранимую базу со снаряжения; `null` — приводить нечего. */
function splitArmorBase(
  state: unknown,
): { equipment: Record<string, unknown>; base: unknown } | null {
  const equipment = fieldsOf(fieldsOf(state).equipment);
  if (!("armorClassBase" in equipment)) return null;
  const { armorClassBase, ...bare } = equipment;
  return { equipment: bare, base: armorClassBase };
}

/**
 * «Прибавки без вещи» жили в снаряжении; теперь это прочие прибавки самого персонажа.
 *
 * Работает и над состоянием, и над снимком отмены: у обоих одна и та же пара «снаряжение —
 * персонаж», и снимок со старым полем возвращал бы прибавку туда, откуда она уехала.
 */
function migrateMiscBonuses(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  if (!("otherBonuses" in equipment)) return state;

  const { otherBonuses, ...rest } = equipment;
  return {
    ...fields,
    equipment: rest,
    ...(fields.miscBonuses === undefined ? { miscBonuses: otherBonuses } : {}),
  };
}

/**
 * Имя, которым прежние версии опознавали поправку к КД среди активных эффектов. Заморожено на дате
 * приведения: нынешняя подпись поправки вправе меняться, а прошлые сохранения — нет.
 */
const LEGACY_ADJUSTMENT_NAME_RU = "Поправка к КД";

/** Эффект прежней формы получает признак поправки: опознание по строке имени умерло. */
function migrateAdjustmentEffect(effect: unknown): unknown {
  const fields = fieldsOf(effect);
  const { nameRu, armorClass, manualKind } = fields;
  if (nameRu !== LEGACY_ADJUSTMENT_NAME_RU || armorClass === undefined || manualKind !== undefined) {
    return effect;
  }
  return { ...fields, manualKind: "armorAdjustment" };
}

function migrateAdjustmentMarker(state: unknown): unknown {
  const fields = fieldsOf(state);
  const { activeEffects } = fields;
  if (!Array.isArray(activeEffects)) return state;

  const effects = activeEffects.map(migrateAdjustmentEffect);
  if (effects.every((effect, index) => effect === activeEffects[index])) return state;
  return { ...fields, activeEffects: effects };
}

/**
 * Снимает из снимка поля, которых состояние больше не знает: отменять поле, которого не существует,
 * нечего. Если после этого возвращать нечего вовсе, снимка у записи не остаётся — она остаётся в
 * журнале историей, а отмена по ней отвечает отказом.
 *
 * Какие поля состояние знает, отвечает его владелец: свой список здесь снимал бы не то, что
 * отвергает объявление снимка.
 */
function withoutForgottenFields(patch: unknown): unknown {
  const fields = fieldsOf(patch);
  const known = Object.entries(fields).filter(([key]) => isStateField(key));
  if (known.length === Object.keys(fields).length) return patch;
  return known.length === 0 ? null : Object.fromEntries(known);
}

/**
 * Приведение снимка отмены. Снимок держит прежние значения изменяемых полей, включая снаряжение
 * прежней формы; без приведения отмена старой записи вернула бы в состояние рода вещей, которых
 * новая модель не знает.
 *
 * Забытые поля снимаются последними: приведение прежних форм само дописывает в снимок поля, и
 * принадлежность проверяется у того набора ключей, который получился.
 */
export function migrateUndoPatch(patch: unknown): unknown {
  return withoutForgottenFields(
    migrateAdjustmentMarker(migrateArmorBasePatch(migrateMiscBonuses(migrateItemCategories(patch)))),
  );
}

export function migrateCharacterState(raw: unknown): unknown {
  return migrateAdjustmentMarker(
    migrateArmorBase(
      migrateMiscBonuses(
        migrateItemCategories(migrateArcaneRecovery(migrateShape(raw))),
      ),
    ),
  );
}

function migrateShape(raw: unknown): unknown {
  // Версии 3 и 4 узнаются по снаряжению, знающему про инвентарь либо хранимую базу защиты;
  // версия 2 — по характеристикам.
  const equipment = fieldsOf(fieldsOf(raw).equipment);
  if (equipment.armorClassBase !== undefined || equipment.items !== undefined) {
    return raw;
  }

  const withAbilities = versionTwoShape.safeParse(raw);
  if (withAbilities.success && withAbilities.data.abilities !== undefined) {
    return migrateVersionTwo(withAbilities.data);
  }

  const versionOne = versionOneShape.safeParse(raw);
  // Испорченное сохранение приведению не поддаётся: его отвергнет схема, назвав поле и причину.
  if (!versionOne.success) return raw;
  return migrateVersionOne(versionOne.data);
}

function migrateVersionTwo(state: z.infer<typeof versionTwoShape>): unknown {
  const { itemBonuses: _moved, armorClass, ...rest } = state;
  return {
    ...rest,
    equipment: migrateEquipment(state, armorClass?.base ?? UNARMORED_ARMOR_CLASS_BASE),
  };
}

function migrateVersionOne(state: z.infer<typeof versionOneShape>): unknown {
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
