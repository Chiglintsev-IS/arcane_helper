import { z } from "zod";

import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { isStateField } from "@/core/domain/assembly/state";
import { UNARMORED_ARMOR_CLASS_BASE } from "@/core/domain/sheet/stats/defense";
import { MAXIMUM_ITEM_COUNT } from "@/core/domain/equipment/schema";
import { Items } from "@/core/domain/items/items";
import { filledWearableOnlyFields, withoutWearableOnlyFields } from "@/core/domain/items/schema";
import { fieldsOf } from "@/core/domain/shared/fields";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { ABILITIES, isStatId, saveStatId, type StatId } from "@/core/domain/shared/stats";
import { FIRE_SUPPRESSION_TURN_STARTS } from "@/core/domain/vitality/blood";
import { CURRENCY_ABBREVIATIONS } from "@/shared/language";

const UNKNOWN_ABILITY_SCORE = 10;

const NO_LEGACY_BONUSES = { spellcasting: 0, armorClass: 0, savingThrows: 0 };

const legacyArmorClass = z.looseObject({
  base: z.number(),
  dexterityModifier: z.number().optional(),
  itemBonus: z.number().optional(),
});

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

const versionTwoShape = z.looseObject({
  abilities: z.unknown().optional(),
  itemBonuses: z.unknown().optional(),
  armorClass: z.looseObject({ base: z.number() }).optional(),
  equipment: z.looseObject({ spellcastingFocus: z.boolean().optional() }).optional(),
});

function scoreFor(modifier: number): number {
  return UNKNOWN_ABILITY_SCORE + modifier * 2;
}

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

const LEGACY_ITEM_KINDS: Record<string, readonly string[]> = {
  gear: ["gear"],
  consumable: ["consumable"],
  ingredient: ["ingredient"],
  other: [],
  potion: ["consumable"],
  junk: [],
};

function legacyKinds(fields: Readonly<Record<string, unknown>>): readonly string[] {
  const { kind } = fields;
  const known = typeof kind === "string" ? LEGACY_ITEM_KINDS[kind] : undefined;
  if (known !== undefined) return known;
  const wornSigns =
    filledWearableOnlyFields(fields).length > 0 ||
    fields.armor !== undefined ||
    fields.armorBase !== undefined;
  return wornSigns || fields.bonuses !== undefined ? ["gear"] : [];
}

function migrateItem(item: unknown): unknown {
  if (item === null || typeof item !== "object") return item;
  const fields = fieldsOf(item);
  const { kinds, count } = fields;
  if (Array.isArray(kinds)) return item;

  const capped = typeof count === "number" && count > MAXIMUM_ITEM_COUNT;
  const migrated = legacyKinds(fields);
  const { kind: _legacy, armor: _armor, armorBase: _armorBase, ...rest } = fields;
  const wearable = migrated.includes("gear");
  return {
    ...(wearable ? rest : withoutWearableOnlyFields(rest)),
    kinds: migrated,
    ...(!wearable && rest.bonuses !== undefined ? { worksCarried: true } : {}),
    ...(capped ? { count: MAXIMUM_ITEM_COUNT } : {}),
  };
}

function wearableItem(definition: Readonly<Record<string, unknown>>): boolean {
  const { kinds } = definition;
  return Array.isArray(kinds) && kinds.includes("gear");
}

function migrateItemKinds(state: unknown): unknown {
  const fields = fieldsOf(state);
  const stored = fields.itemDefinitions;
  if (!Array.isArray(stored)) return state;

  const items = stored.map(migrateItem);
  if (items.every((item, index) => item === stored[index])) return state;
  return { ...fields, itemDefinitions: items };
}

/**
 * Знание об ингредиенте жило отдельным списком и опознавалось названием; теперь свойства
 * принадлежат самой вещи. Прежние записи переносятся к вещи с тем же выведенным идентификатором,
 * а вещь, которой ещё не было, заводится ингредиентом.
 */
function migrateIngredientKnowledge(state: unknown): unknown {
  const fields = fieldsOf(state);
  const stored = fields.ingredientKnowledge;
  if (!Array.isArray(stored)) return state;

  const definitions = Array.isArray(fields.itemDefinitions) ? [...fields.itemDefinitions] : [];
  for (const record of stored) {
    const known = fieldsOf(record);
    const nameRu = typeof known.nameRu === "string" ? known.nameRu.trim() : "";
    if (nameRu === "") continue;

    const id = Items.idFromName(nameRu);
    const alchemy = {
      properties: known.properties ?? [],
      observations: known.observations ?? [],
      propertiesExhausted: known.propertiesExhausted === true,
    };
    const at = definitions.findIndex((item) => fieldsOf(item).id === id);
    if (at < 0) {
      definitions.push({ id, nameRu, kinds: ["ingredient"], alchemy });
      continue;
    }
    const item = fieldsOf(definitions[at]);
    const kinds = Array.isArray(item.kinds) ? item.kinds : [];
    definitions[at] = {
      ...item,
      kinds: kinds.includes("ingredient") ? kinds : [...kinds, "ingredient"],
      alchemy,
    };
  }

  const { ingredientKnowledge: _moved, ...rest } = fields;
  return { ...rest, itemDefinitions: definitions };
}

/**
 * Редкость жила записью у каждого вида, и один и тот же эффект приходилось называть заново у
 * каждого ингредиента. Она принадлежит свойству: названные редкости собираются в знание алхимика,
 * у видов остаются номер и название.
 */
function migratePropertyRarities(state: unknown): unknown {
  const fields = fieldsOf(state);
  const stored = fields.itemDefinitions;
  if (!Array.isArray(stored)) return state;

  const named: { nameRu: unknown; rarity: unknown }[] = Array.isArray(fields.propertyRarities)
    ? [...fields.propertyRarities]
    : [];
  let moved = false;

  const definitions = stored.map((raw) => {
    const item = fieldsOf(raw);
    const alchemy = fieldsOf(item.alchemy);
    const properties = alchemy.properties;
    if (!Array.isArray(properties)) return raw;

    const bare = properties.map((entry) => {
      const { rarity, ...rest } = fieldsOf(entry);
      if (rarity === undefined) return entry;
      if (!named.some((one) => fieldsOf(one).nameRu === rest.nameRu)) {
        named.push({ nameRu: rest.nameRu, rarity });
      }
      return rest;
    });
    if (bare.every((entry, index) => entry === properties[index])) return raw;
    moved = true;
    return { ...item, alchemy: { ...alchemy, properties: bare } };
  });

  if (!moved) return state;
  return { ...fields, itemDefinitions: definitions, propertyRarities: named };
}

function migrateItemCategories(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const stored = equipment.items;
  if (!Array.isArray(stored)) return state;

  const items = stored.map(migrateItem);
  if (items.every((item, index) => item === stored[index])) return state;
  return { ...fields, equipment: { ...equipment, items } };
}

function migrateArmorBase(state: unknown): unknown {
  const split = splitArmorBase(state);
  if (split === null) return state;
  return { ...fieldsOf(state), equipment: split.equipment };
}

function splitArmorBase(state: unknown): { equipment: Record<string, unknown> } | null {
  const equipment = fieldsOf(fieldsOf(state).equipment);
  if (!("armorClassBase" in equipment)) return null;
  const { armorClassBase: _dropped, ...bare } = equipment;
  return { equipment: bare };
}

function migrateItemsSplit(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const stored = equipment.items;
  if (!Array.isArray(stored)) return state;

  const itemDefinitions: unknown[] = [];
  const bag: unknown[] = [];
  const worn: unknown[] = [];
  for (const raw of stored) {
    if (raw === null || typeof raw !== "object") {
      itemDefinitions.push(raw);
      continue;
    }
    const item = fieldsOf(raw);
    const { worn: isWorn, count, ...definition } = item;
    itemDefinitions.push(definition);
    const entry = { itemId: definition.id, count: typeof count === "number" ? count : 1 };
    (isWorn === true && wearableItem(definition) ? worn : bag).push(entry);
  }

  const { items: _dropped, ...restEquipment } = equipment;
  const previousDefinitions = Array.isArray(fields.itemDefinitions) ? fields.itemDefinitions : [];
  return {
    ...fields,
    itemDefinitions: [...previousDefinitions, ...itemDefinitions],
    equipment: { ...restEquipment, bag, worn },
  };
}

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

const LEGACY_FOCUS_ITEM_ID = "spellcasting-focus";
const LEGACY_FOCUS_NAME_RU = "Магическая фокусировка";

function migrateFocusItem(item: unknown): unknown {
  const fields = fieldsOf(item);
  if (fields.id !== LEGACY_FOCUS_ITEM_ID || fields.spellcastingFocus === true) return item;
  return { ...fields, kind: "gear", spellcastingFocus: true };
}

function migrateFocusItems(state: unknown): unknown {
  const fields = fieldsOf(state);
  const stored = fields.itemDefinitions;
  if (!Array.isArray(stored)) return state;

  const items = stored.map(migrateFocusItem);
  if (items.every((item, index) => item === stored[index])) return state;
  return { ...fields, itemDefinitions: items };
}

function migrateSpellcastingFocus(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const components = fieldsOf(equipment.components);
  if (!("spellcastingFocus" in components)) return state;

  const { spellcastingFocus, ...rest } = components;
  const withoutFlag = { ...equipment, components: rest };
  if (spellcastingFocus !== true) return { ...fields, equipment: withoutFlag };

  const definitions: readonly unknown[] = Array.isArray(fields.itemDefinitions)
    ? fields.itemDefinitions
    : [];
  const worn: readonly unknown[] = Array.isArray(equipment.worn) ? equipment.worn : [];
  return {
    ...fields,
    itemDefinitions: definitions.some((item) => fieldsOf(item).id === LEGACY_FOCUS_ITEM_ID)
      ? definitions
      : [...definitions, { id: LEGACY_FOCUS_ITEM_ID, nameRu: LEGACY_FOCUS_NAME_RU, kind: "gear" }],
    equipment: {
      ...withoutFlag,
      worn: worn.some((entry) => fieldsOf(entry).itemId === LEGACY_FOCUS_ITEM_ID)
        ? worn
        : [...worn, { itemId: LEGACY_FOCUS_ITEM_ID, count: 1 }],
    },
  };
}

const LEGACY_BOUGHT_MATERIALS: Record<
  string,
  { nameRu: string; kind: string; price: { amount: number; currency: string } }
> = {
  identify: {
    nameRu: `жемчужина стоимостью не менее 100 ${CURRENCY_ABBREVIATIONS.gold}`,
    kind: "other",
    price: { amount: 100, currency: "gold" },
  },
  "find-familiar": {
    nameRu:
      `уголь, благовония и травы стоимостью 10 ${CURRENCY_ABBREVIATIONS.gold},` +
      " сжигаемые в огне в латунной жаровне",
    kind: "consumable",
    price: { amount: 10, currency: "gold" },
  },
};

function migrateBoughtMaterials(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const { materialsForSpellIds, ...rest } = fieldsOf(equipment.components);
  if (!Array.isArray(materialsForSpellIds) || !Array.isArray(equipment.bag)) return state;

  const bought = materialsForSpellIds.flatMap((spellId: unknown) => {
    const material = typeof spellId === "string" ? LEGACY_BOUGHT_MATERIALS[spellId] : undefined;
    return material === undefined ? [] : [{ id: Items.idFromName(material.nameRu), ...material }];
  });

  const definitions: unknown[] = Array.isArray(fields.itemDefinitions)
    ? [...fields.itemDefinitions]
    : [];
  const bag: unknown[] = [...equipment.bag];
  for (const material of bought) {
    if (!definitions.some((item) => fieldsOf(item).id === material.id)) definitions.push(material);
    if (!bag.some((entry) => fieldsOf(entry).itemId === material.id)) {
      bag.push({ itemId: material.id, count: 1 });
    }
  }

  return {
    ...fields,
    itemDefinitions: definitions,
    equipment: { ...equipment, components: rest, bag },
  };
}

const LEGACY_ADJUSTMENT_NAME_RU = "Поправка к КД";

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

function withoutForgottenFields(patch: unknown): unknown {
  const fields = fieldsOf(patch);
  const known = Object.entries(fields).filter(([key]) => isStateField(key));
  if (known.length === Object.keys(fields).length) return patch;
  return known.length === 0 ? null : Object.fromEntries(known);
}

const LEGACY_BONUS_TARGETS: Record<string, readonly StatId[]> = {
  spellcasting: ["spellSaveDc", "spellAttackModifier"],
  armorClass: ["armorClass"],
  savingThrows: ABILITIES.map(saveStatId),
};

function bonusesToStats(legacy: unknown): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const [word, value] of Object.entries(fieldsOf(legacy))) {
    if (typeof value !== "number" || value === 0) continue;
    for (const stat of LEGACY_BONUS_TARGETS[word] ?? (isStatId(word) ? [word] : [])) {
      bonuses[stat] = value;
    }
  }
  return bonuses;
}

function namedByLegacyWords(bonuses: unknown): boolean {
  return Object.keys(fieldsOf(bonuses)).some((word) => !isStatId(word));
}

function dropHandEnteredNumbers(state: unknown): unknown {
  const fields = fieldsOf(state);
  if (fields.overrides === undefined && fields.miscBonuses === undefined) return state;

  const { overrides: _overrides, miscBonuses: _miscBonuses, ...rest } = fields;
  return rest;
}

function migrateItemShape(item: unknown): unknown {
  if (item === null || typeof item !== "object") return item;
  const fields = fieldsOf(item);
  const { bonuses, ...rest } = fields;
  if (!namedByLegacyWords(bonuses)) return item;

  const stats = bonusesToStats(bonuses);
  return { ...rest, ...(Object.keys(stats).length === 0 ? {} : { bonuses: stats }) };
}

function migratedList(stored: unknown): unknown[] | null {
  if (!Array.isArray(stored)) return null;
  const items = stored.map(migrateItemShape);
  return items.every((item, index) => item === stored[index]) ? null : items;
}

function migrateItemShapes(state: unknown): unknown {
  const fields = fieldsOf(state);
  const equipment = fieldsOf(fields.equipment);
  const inEquipment = migratedList(equipment.items);
  const defined = migratedList(fields.itemDefinitions);
  if (inEquipment === null && defined === null) return state;

  return {
    ...fields,
    ...(inEquipment === null ? {} : { equipment: { ...equipment, items: inEquipment } }),
    ...(defined === null ? {} : { itemDefinitions: defined }),
  };
}

function migrateEffectContributions(effect: unknown): unknown {
  if (effect === null || typeof effect !== "object") return effect;
  const fields = fieldsOf(effect);
  if (fields.armorClass === undefined) return effect;

  const { armorClass, ...rest } = fields;
  const legacy = fieldsOf(armorClass);
  const value = legacy.value;
  if (typeof value !== "number") return { ...rest, contributions: [] };

  return {
    ...rest,
    contributions: [
      legacy.kind === "base_override"
        ? { stat: "armorClass", kind: "method", method: { family: "spell", base: value } }
        : { stat: "armorClass", kind: "bonus", value },
    ],
  };
}

function migrateFireSuppression(state: unknown): unknown {
  const fields = fieldsOf(state);
  const suppression = fieldsOf(fields.suppression);
  const { firedUpon, ...rest } = suppression;
  if (typeof firedUpon !== "boolean") return state;

  return {
    ...fields,
    suppression: {
      ...rest,
      firedUponTurnStarts: firedUpon ? FIRE_SUPPRESSION_TURN_STARTS : 0,
    },
  };
}

const LEGACY_UNTIMED_DURATION = "special";

function migrateEffectDuration(effect: unknown): unknown {
  const fields = fieldsOf(effect);
  const duration = fieldsOf(fields.duration);
  if (duration.type !== LEGACY_UNTIMED_DURATION) return effect;

  return {
    ...fields,
    duration: {
      ...duration,
      type: fields.spellId === undefined ? "until_removed" : "until_spell_ends",
    },
  };
}

function migrateEffect(effect: unknown): unknown {
  return migrateEffectDuration(migrateEffectContributions(effect));
}

function migrateEffectShapes(state: unknown): unknown {
  const fields = fieldsOf(state);
  const { activeEffects } = fields;
  if (!Array.isArray(activeEffects)) return state;

  const effects = activeEffects.map(migrateEffect);
  if (effects.every((effect, index) => effect === activeEffects[index])) return state;
  return { ...fields, activeEffects: effects };
}

function migrated(state: unknown, steps: readonly ((state: unknown) => unknown)[]): unknown {
  return steps.reduce((carried, step) => step(carried), state);
}

export function migrateUndoPatch(patch: unknown): unknown {
  return migrated(patch, [
    migrateFireSuppression,
    migrateItemShapes,
    migrateItemCategories,
    migrateMiscBonuses,
    migrateArmorBase,
    migrateItemsSplit,
    migrateItemShapes,
    dropHandEnteredNumbers,
    migrateAdjustmentMarker,
    migrateEffectShapes,
    migrateFocusItems,
    migrateIngredientKnowledge,
    migratePropertyRarities,
    migrateItemKinds,
    withoutForgottenFields,
  ]);
}

export function migrateCharacterState(raw: unknown): unknown {
  return migrated(raw, [
    migrateShape,
    migrateFireSuppression,
    migrateArcaneRecovery,
    migrateItemShapes,
    migrateItemCategories,
    migrateMiscBonuses,
    migrateArmorBase,
    migrateItemsSplit,
    migrateItemShapes,
    dropHandEnteredNumbers,
    migrateAdjustmentMarker,
    migrateEffectShapes,
    migrateSpellcastingFocus,
    migrateBoughtMaterials,
    migrateFocusItems,
    migrateIngredientKnowledge,
    migratePropertyRarities,
    migrateItemKinds,
  ]);
}

function migrateShape(raw: unknown): unknown {
  const equipment = fieldsOf(fieldsOf(raw).equipment);
  if (
    equipment.armorClassBase !== undefined ||
    equipment.items !== undefined ||
    equipment.bag !== undefined
  ) {
    return raw;
  }

  const withAbilities = versionTwoShape.safeParse(raw);
  if (withAbilities.success && withAbilities.data.abilities !== undefined) {
    return migrateVersionTwo(withAbilities.data);
  }

  const versionOne = versionOneShape.safeParse(raw);
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
