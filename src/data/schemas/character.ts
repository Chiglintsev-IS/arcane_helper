/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Инварианты — docs/domain-model.md. Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { MAXIMUM_SPELL_LEVEL } from "./spell";

/** Версия формата экспорта. Файл неизвестной версии отклоняется (F-11). */
export const EXPORT_SCHEMA_VERSION = 1;

const nonEmpty = z.string().trim().min(1);
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Ожидается дата и время в формате ISO 8601",
});

const slotSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int(),
  })
  .refine((slot) => slot.remaining <= slot.maximum, {
    message: "Осталось ячеек не может быть больше максимума",
    path: ["remaining"],
  });

/** Ключи — уровни ячеек 1…9 в строковом виде: JSON других ключей не знает. */
export const spellSlotsSchema = z.record(
  z.coerce.number().int().min(1).max(MAXIMUM_SPELL_LEVEL),
  slotSchema,
);

export const activeEffectSchema = z.object({
  id: nonEmpty,
  spellId: nonEmpty,
  nameRu: nonEmpty,

  type: z.enum(["buff", "control", "utility", "summon"]),
  startedAt: isoDateTime,

  duration: z.object({
    type: z.enum(["rounds", "minutes", "hours", "special"]),
    value: z.number().int().positive().optional(),
  }),

  isConcentration: z.boolean(),
  slotLevelUsed: z.number().int().min(0).max(MAXIMUM_SPELL_LEVEL),

  repeatableAction: z
    .object({ label: nonEmpty, description: nonEmpty })
    .optional(),

  endConditionRu: nonEmpty,
  note: nonEmpty.optional(),
});

export const roleplayProfileSchema = z.object({
  tone: z.array(z.enum(["serious", "mysterious", "sarcastic", "wild"])).min(1),
  magicThemes: z.array(nonEmpty),
  speechStyle: nonEmpty,
  gestureStyle: nonEmpty,
  preferredElements: z.array(nonEmpty),
  prohibitedThemes: z.array(nonEmpty),
  maximumPhraseLength: z.number().int().positive(),
});

const roleplayPreferenceSchema = z.object({
  favoriteVariantIds: z.array(nonEmpty),
  disabledVariantIds: z.array(nonEmpty),
  customVariants: z.array(
    z.object({
      id: nonEmpty,
      category: z.enum(["short", "atmospheric", "sarcastic"]),
      text: nonEmpty,
    }),
  ),
  usageCount: z.record(nonEmpty, z.number().int().nonnegative()),
});

export const characterStateSchema = z
  .object({
    id: nonEmpty,
    name: nonEmpty,
    className: nonEmpty,
    level: z.number().int().min(1).max(20),

    intelligence: z.number().int().min(1).max(30),
    // Производные числа — хранимые, а не вычисляемые: предметы и черты их сдвигают (OQ-11).
    spellSaveDc: z.number().int(),
    spellAttackModifier: z.number().int(),
    constitutionSaveModifier: z.number().int(),

    cantripIds: z.array(nonEmpty),
    spellbookSpellIds: z.array(nonEmpty),
    preparedSpellIds: z.array(nonEmpty),

    spellSlots: spellSlotsSchema,
    reactionAvailable: z.boolean(),

    concentration: z
      .object({ spellId: nonEmpty, startedAt: isoDateTime })
      .optional(),

    activeEffects: z.array(activeEffectSchema),
    roleplayProfile: roleplayProfileSchema,

    turnTracking: z.object({
      enabled: z.boolean(),
      actionAvailable: z.boolean(),
      bonusActionAvailable: z.boolean(),
    }),

    arcaneRecoveryAvailable: z.boolean(),

    spellNotes: z.record(nonEmpty, nonEmpty),
    roleplayPreferences: z.record(nonEmpty, roleplayPreferenceSchema),
  })
  .superRefine((character, context) => {
    // Идентификаторы не дублируются ни в одной коллекции.
    for (const field of ["cantripIds", "spellbookSpellIds", "preparedSpellIds"] as const) {
      const ids = character[field];
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Список содержит повторяющиеся идентификаторы",
        });
      }
    }

    // Заговоры и книга заклинаний не пересекаются: заговор не занимает места в книге.
    const cantrips = new Set(character.cantripIds);
    for (const id of character.spellbookSpellIds) {
      if (cantrips.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["spellbookSpellIds"],
          message: `Заклинание «${id}» одновременно заговор и запись в книге`,
        });
        break;
      }
    }

    // Подготовленные — подмножество книги (FR-100).
    const spellbook = new Set(character.spellbookSpellIds);
    for (const id of character.preparedSpellIds) {
      if (!spellbook.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["preparedSpellIds"],
          message: `Подготовлено заклинание «${id}», которого нет в книге`,
        });
        break;
      }
    }

    // Концентрация всегда сопровождается активным эффектом (FR-080, FR-090).
    if (character.concentration !== undefined) {
      const matching = character.activeEffects.find(
        (effect) => effect.isConcentration && effect.spellId === character.concentration?.spellId,
      );
      if (matching === undefined) {
        context.addIssue({
          code: "custom",
          path: ["activeEffects"],
          message: "Активная концентрация без соответствующего активного эффекта",
        });
      }
    }

    // Не более одного концентрационного эффекта одновременно (FR-080).
    const concentrationEffects = character.activeEffects.filter((effect) => effect.isConcentration);
    if (concentrationEffects.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["activeEffects"],
        message: `Одновременно активно ${concentrationEffects.length} концентрационных эффекта`,
      });
    }
  });

export const exportFileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  character: characterStateSchema,
  spells: z.array(z.unknown()),
});

export type SpellSlotsData = z.infer<typeof spellSlotsSchema>;
export type ActiveEffect = z.infer<typeof activeEffectSchema>;
export type RoleplayProfile = z.infer<typeof roleplayProfileSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
