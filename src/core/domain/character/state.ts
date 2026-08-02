/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { armorClassEffectSchema, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { DEFAULT_SCREEN_MODE, SCREEN_MODES } from "@/core/shared/screenMode";

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

  // Копия вклада заклинания в КД: итог считается из одного состояния, без каталога.
  armorClass: armorClassEffectSchema.optional(),

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

/**
 * Пометки игрока на вариантах отыгрыша одного заклинания.
 *
 * Идентификатор готового варианта — категория и место в карточке (`short-0`), собственного — тот,
 * что выдан при создании. Счётчик использований ведёт ротацию: показывается реже других
 * использованный вариант.
 */
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
    // Производные числа — хранимые, а не вычисляемые: предметы и черты их сдвигают.
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

    /**
     * Кэш экономии хода для интерфейса. Признака «включён» здесь нет: учёт ведётся ровно в режиме
     * «Бой» и больше нигде — вне боя ходов не существует, и отдельный переключатель
     * предлагал бы считать то, чего нет.
     */
    turnTracking: z.object({
      actionAvailable: z.boolean(),
      bonusActionAvailable: z.boolean(),
    }),

    /**
     * Выбранный режим экрана.
     *
     * Со значением по умолчанию, а не обязательное: иначе сохранения, сделанные до появления
     * режимов, перестали бы читаться, а обновление приложения не имеет права терять данные
     *. Отсутствие поля означает «первый запуск после обновления», а не порчу.
     */
    screenMode: z.enum(SCREEN_MODES).default(DEFAULT_SCREEN_MODE),

    /**
     * Временные хиты.
     *
     * Отдельным числом, а не прибавкой к текущим: сложенные вместе, они молча исказили бы и
     * максимум, и КС проверки концентрации. Со значением по умолчанию — по той же причине, что и
     * `screenMode`.
     */
    temporaryHitPoints: z.number().int().nonnegative().default(0),

    arcaneRecoveryAvailable: z.boolean(),
    /**
     * Был ли короткий отдых с последнего долгого.
     *
     * Необязательное намеренно: обязательное отвергло бы сохранения прежних версий, а обновление не
     * имеет права терять данные. `undefined` читается как «отдыха не было» — это честнее
     * молчаливого разрешения, а цена ошибки всего одно лишнее предупреждение.
     */
    shortRestSinceLongRest: z.boolean().optional(),

    // Хиты нужны потому, что кровавое колдовство покупает магию здоровьем (F-15).
    hitPoints: z
      .object({
        current: z.number().int(),
        maximum: z.number().int().positive(),
        maximumReduction: z.number().int().nonnegative(),
      })
      .refine((value) => value.current <= value.maximum, {
        message: "Текущее здоровье не может превышать максимум",
        path: ["current"],
      }),

    // Слагаемые КД раздельно: «Доспехи мага» заменяют базу, а не прибавляют к итогу.
    armorClass: z.object({
      base: z.number().int().positive(),
      dexterityModifier: z.number().int(),
      itemBonus: z.number().int(),
    }),

    /**
     * Снаряжение, от которого зависит проверка компонентов.
     *
     * Минимальная модель: чем заменяются компоненты без стоимости и что из дорогого лежит в сумке.
     * Инвентарь целиком вне MVP — учитываются только компоненты заклинаний.
     *
     * Поле необязательное: та же схема проверяет импорт чужих выгрузок, и старая выгрузка
     * его не знает. Без него проверка ведёт себя как прежде — перечисляет компоненты напоминанием.
     */
    equipment: z
      .object({
        spellcastingFocus: z.boolean(),
        componentPouch: z.boolean(),
        /** Идентификаторы заклинаний, чей дорогой компонент есть в сумке. */
        materialsForSpellIds: z.array(nonEmpty),
      })
      .optional(),

    runes: z
      .object({
        maximum: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
      })
      .refine((value) => value.remaining <= value.maximum, {
        message: "Рун не может остаться больше максимума",
        path: ["remaining"],
      }),

    /**
     * Кости хитов: по одной за уровень, размер задаёт класс — у волшебника d6.
     *
     * Поле необязательное: той же схемой проверяется импорт чужих данных
     *, и выгрузка прежней версии не
     * обязана его знать. У Торна
     * оно есть — этого требует тест контента.
     */
    hitDice: z
      .object({
        total: z.number().int().positive(),
        size: z.number().int().positive(),
        remaining: z.number().int().nonnegative(),
      })
      .refine((value) => value.remaining <= value.total, {
        message: "Костей хитов не может остаться больше, чем есть",
        path: ["remaining"],
      })
      .optional(),

    spellPoints: z
      .object({
        remaining: z.number().int().nonnegative(),
        createdAt: isoDateTime.nullable(),
      })
      .refine((value) => value.remaining === 0 || value.createdAt !== null, {
        message: "У очков заклинаний должно быть время создания: иначе их нечем погасить через час",
        path: ["createdAt"],
      }),

    suppression: z.object({
      firedUpon: z.boolean(),
      underDirectSunlight: z.boolean(),
    }),

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

    // Подготовленные — подмножество книги.
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

    // Концентрация всегда сопровождается активным эффектом.
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

    // Не более одного концентрационного эффекта одновременно.
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

/**
 * Что не меняется за игровую сессию: лист персонажа. Меняется только целиком, заменой персонажа.
 */
const SHEET_KEYS = [
  "id",
  "name",
  "className",
  "level",
  "intelligence",
  "spellSaveDc",
  "spellAttackModifier",
  "constitutionSaveModifier",
  "armorClass",
  "roleplayProfile",
  // Режим экрана — состояние интерфейса: его смена ничего не расходует и отмене не подлежит.
  "screenMode",
] as const satisfies readonly (keyof CharacterStateShape)[];

/**
 * Поля, попадающие в снимок отмены: всё, кроме листа персонажа.
 *
 * Выводится вычитанием, а не перечисляется руками. Ручной список требовал бы помнить про него при
 * каждом новом ресурсе, и забытая строка молча оставляла бы ресурс потраченным после отмены.
 */
export const MUTABLE_STATE_KEYS = (
  Object.keys(characterStateSchema.shape) as (keyof CharacterStateShape)[]
).filter((key) => !(SHEET_KEYS as readonly string[]).includes(key));

type CharacterStateShape = z.infer<typeof characterStateSchema>;

export type SpellSlotsData = z.infer<typeof spellSlotsSchema>;
export type ActiveEffect = z.infer<typeof activeEffectSchema>;
export type RoleplayProfile = z.infer<typeof roleplayProfileSchema>;
export type RoleplayPreference = z.infer<typeof roleplayPreferenceSchema>;
export type HitDice = NonNullable<z.infer<typeof characterStateSchema>["hitDice"]>;
export type Equipment = NonNullable<z.infer<typeof characterStateSchema>["equipment"]>;
export type CharacterState = z.infer<typeof characterStateSchema>;
