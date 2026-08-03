/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { armorClassEffectSchema, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { DEFAULT_SCREEN_MODE, SCREEN_MODES } from "@/core/shared/screenMode";

import { ABILITIES, SKILL_IDS, SKILL_TRAINING } from "./skills";

/** Версия формата экспорта. Файл неизвестной версии отклоняется, прежний — приводится. */
export const EXPORT_SCHEMA_VERSION = 2;

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
  /** Отсутствует у эффекта, заведённого игроком вручную: статуса или чужого вклада в КД. */
  spellId: nonEmpty.optional(),
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

/** База Класса Доспеха без доспехов — правило, а не настройка снаряжения. */
export const UNARMORED_ARMOR_CLASS_BASE = 10;

/**
 * Категория вещи — четыре ответа на вопрос «что с этим делают»: экипировку надевают, расходник
 * тратят счётом, ингредиент копят под алхимию, остальное — «другое», пока стол не решил иначе.
 */
export const ITEM_KINDS = ["gear", "consumable", "ingredient", "other"] as const;

/** Монеты стола: золото, серебро, медь. Платину и электрум стол не использует — решение игрока. */
export const CURRENCIES = ["gold", "silver", "copper"] as const;

/** Верхний предел счёта вещи. Ноль — состояние, а не отсутствие: вещь с нулём остаётся в сумке. */
export const MAXIMUM_ITEM_COUNT = 9999;

/** Верхний предел одной монеты в кошельке. */
export const MAXIMUM_COIN_AMOUNT = 999_999;

const coinAmount = z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT);

export const moneySchema = z.object({
  gold: coinAmount.default(0),
  silver: coinAmount.default(0),
  copper: coinAmount.default(0),
});

export const NO_MONEY = { gold: 0, silver: 0, copper: 0 };

/** Цена вещи. Необязательна: у находки из подземелья её может не назвать и мастер. */
const priceSchema = z.object({
  amount: z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT),
  currency: z.enum(CURRENCIES),
});

/**
 * Вещь в инвентаре.
 *
 * Прибавка необязательна: большая часть вещей на числа не влияет, и нулевые поля у каждой верёвки
 * означали бы, что верёвка участвует в счёте Класса Доспеха.
 */
const inventoryItemSchema = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  /** Категория без явного выбора — «другое»: неопознанную находку не заставляют классифицировать. */
  kind: z.enum(ITEM_KINDS).default("other"),
  /** Надето и потому действует. Лежащее в сумке к числам не прибавляется. */
  worn: z.boolean().default(false),
  /** Сколько экземпляров лежит вместе. Ноль остаётся в сумке: кончилось — не то же, что выброшено. */
  count: z.number().int().min(0).max(MAXIMUM_ITEM_COUNT).default(1),
  price: priceSchema.optional(),
  note: nonEmpty.optional(),
  bonuses: z
    .object({
      spellcasting: z.number().int().default(0),
      armorClass: z.number().int().default(0),
      savingThrows: z.number().int().default(0),
    })
    .optional(),
});

const abilityScore = z.number().int().min(1).max(30);

/** Размер существа: из перечисления правил, потому что от него зависят правила захвата и укрытия. */
export const CREATURE_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

const abilitiesSchema = z.object({
  strength: abilityScore,
  dexterity: abilityScore,
  constitution: abilityScore,
  intelligence: abilityScore,
  wisdom: abilityScore,
  charisma: abilityScore,
});

const overridesSchema = z
  .object({
    proficiencyBonus: z.number().int().optional(),
    spellSaveDc: z.number().int().optional(),
    spellAttackModifier: z.number().int().optional(),
    preparedLimit: z.number().int().positive().optional(),
    initiative: z.number().int().optional(),
    passivePerception: z.number().int().optional(),
    saves: z.partialRecord(z.enum(ABILITIES), z.number().int()).default({}),
    skills: z.partialRecord(z.enum(SKILL_IDS), z.number().int()).default({}),
  })
  .default({ saves: {}, skills: {} });

export const characterStateSchema = z
  .object({
    id: nonEmpty,
    name: nonEmpty,
    className: nonEmpty,
    level: z.number().int().min(1).max(20),

    /**
     * Справочные поля листа. Со значением по умолчанию, а не обязательные: сохранение, сделанное до
     * появления листа, обязано читаться — обновление не имеет права терять данные.
     */
    species: nonEmpty.or(z.literal("")).default(""),
    subclass: nonEmpty.or(z.literal("")).default(""),
    age: z.number().int().nonnegative().default(0),
    size: z.enum(CREATURE_SIZES).default("medium"),
    speed: z.number().int().nonnegative().default(30),

    abilities: abilitiesSchema,
    saveProficiencies: z.array(z.enum(ABILITIES)).default([]),
    skills: z.partialRecord(z.enum(SKILL_IDS), z.enum(SKILL_TRAINING)).default({}),
    proficiencies: z
      .object({
        weapons: z.array(nonEmpty).default([]),
        armor: z.array(nonEmpty).default([]),
        tools: z.array(nonEmpty).default([]),
        languages: z.array(nonEmpty).default([]),
      })
      .default({ weapons: [], armor: [], tools: [], languages: [] }),

    overrides: overridesSchema,

    exhaustion: z.number().int().min(0).max(6).default(0),
    inspiration: z.boolean().default(false),

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

    /**
     * Дневной бюджет «Магического восстановления» уровнями ячеек: сколько всего и сколько осталось
     * до следующего долгого отдыха. За столом его берут частями — остаток может быть нулём без
     * долгого отдыха, а не только целиком доступен или целиком потрачен.
     */
    arcaneRecovery: z
      .object({
        maximum: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
      })
      .refine((value) => value.remaining <= value.maximum, {
        message: "Бюджет магического восстановления не может остаться больше максимума",
        path: ["remaining"],
      }),
    /**
     * Был ли короткий отдых с последнего долгого.
     *
     * Необязательное намеренно: обязательное отвергло бы сохранения прежних версий, а обновление не
     * имеет права терять данные. `undefined` читается как «отдыха не было» — это честнее
     * молчаливого разрешения, а цена ошибки всего одно лишнее предупреждение.
     */
    shortRestSinceLongRest: z.boolean().optional(),

    /**
     * Здоровье тремя слагаемыми: база с листа и два снижения. Действующий максимум считается.
     * Одно поле «максимум, уже уменьшенный кровью» смешивало два факта, и правка базы требовала
     * вычесть снижение руками.
     */
    hitPoints: z
      .object({
        current: z.number().int(),
        maximumBase: z.number().int().positive(),
        bloodReduction: z.number().int().nonnegative(),
        masterReduction: z.number().int().nonnegative().default(0),
      })
      .refine(
        (value) => value.current <= value.maximumBase - value.bloodReduction - value.masterReduction,
        {
          message: "Текущее здоровье не может превышать действующий максимум",
          path: ["current"],
        },
      ),

    /**
     * Снаряжение, от которого зависит проверка компонентов.
     *
     * Минимальная модель: чем заменяются компоненты без стоимости и что из дорогого лежит в сумке.
     * Инвентарь целиком вне MVP — учитываются только компоненты заклинаний.
     *
     * Поле необязательное: та же схема проверяет импорт чужих выгрузок, и старая выгрузка
     * его не знает. Без него проверка ведёт себя как прежде — перечисляет компоненты напоминанием.
     */
    /**
     * Снаряжение: чем персонаж располагает вещественно.
     *
     * Числа отсюда, а не с листа персонажа: «+1 к магии» — свойство предмета, а не Торна. Поле со
     * значениями по умолчанию, а не обязательное: сохранение прежней версии обязано читаться.
     */
    equipment: z
      .object({
        /** База Класса Доспеха: надетый доспех или его отсутствие. */
        armorClassBase: z.number().int().positive().default(UNARMORED_ARMOR_CLASS_BASE),

        /**
         * Прибавки, не привязанные к вещи.
         *
         * Второй источник рядом с инвентарём намеренно: приведение прежних данных не имеет права
         * выдумывать названия предметов, а игрок не обязан заводить инвентарь ради своих +1.
         */
        otherBonuses: z
          .object({
            spellcasting: z.number().int().default(0),
            armorClass: z.number().int().default(0),
            savingThrows: z.number().int().default(0),
          })
          .default({ spellcasting: 0, armorClass: 0, savingThrows: 0 }),

        items: z.array(inventoryItemSchema).default([]),

        /** Кошелёк. Со значениями по умолчанию: сохранение прежней версии денег не знало. */
        money: moneySchema.default(NO_MONEY),

        /**
         * Сведения о компонентах. Необязательные: отсутствие записи — не пустая сумка, а незнание,
         * и вердикта о компонентах в этом случае нет вовсе.
         */
        components: z
          .object({
            spellcastingFocus: z.boolean(),
            componentPouch: z.boolean(),
            /** Идентификаторы заклинаний, чей дорогой компонент есть в сумке. */
            materialsForSpellIds: z.array(nonEmpty),
          })
          .optional(),
      })
      .default({
        armorClassBase: UNARMORED_ARMOR_CLASS_BASE,
        otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
        items: [],
        money: NO_MONEY,
      }),

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

    /**
     * Очки заклинаний: только остаток. Время создания схема не хранит — гасит их не срок, а любой
     * отмеченный час, независимо от того, когда они появились.
     */
    spellPoints: z.object({
      remaining: z.number().int().nonnegative(),
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
 * Поля, не попадающие в снимок отмены: справочные записи листа и состояние интерфейса. Их правка
 * ничего не расходует, и возвращать их журналом было бы нечего.
 */
const UNRECORDED_KEYS = [
  "id",
  "name",
  "className",
  "species",
  "subclass",
  "age",
  "size",
  "speed",
  "proficiencies",
  "roleplayProfile",
  "screenMode",
] as const satisfies readonly (keyof CharacterStateShape)[];

/**
 * Поля, попадающие в снимок отмены: всё, кроме справочных.
 *
 * Выводится вычитанием, а не перечисляется руками. Ручной список требовал бы помнить про него при
 * каждом новом ресурсе, и забытая строка молча оставляла бы ресурс потраченным после отмены.
 */
export const MUTABLE_STATE_KEYS = (
  Object.keys(characterStateSchema.shape) as (keyof CharacterStateShape)[]
).filter((key) => !(UNRECORDED_KEYS as readonly string[]).includes(key));

type CharacterStateShape = z.infer<typeof characterStateSchema>;

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type ItemBonuses = NonNullable<InventoryItem["bonuses"]>;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type ItemPrice = NonNullable<InventoryItem["price"]>;
export type Currency = (typeof CURRENCIES)[number];
export type Money = z.infer<typeof moneySchema>;
export type CreatureSize = (typeof CREATURE_SIZES)[number];
export type Abilities = z.infer<typeof abilitiesSchema>;
export type Overrides = z.infer<typeof overridesSchema>;

export type SpellSlotsData = z.infer<typeof spellSlotsSchema>;
export type ActiveEffect = z.infer<typeof activeEffectSchema>;
export type RoleplayProfile = z.infer<typeof roleplayProfileSchema>;
export type RoleplayPreference = z.infer<typeof roleplayPreferenceSchema>;
export type HitDice = NonNullable<z.infer<typeof characterStateSchema>["hitDice"]>;
export type Equipment = z.infer<typeof characterStateSchema>["equipment"];
export type CharacterState = z.infer<typeof characterStateSchema>;
