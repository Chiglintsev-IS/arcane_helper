/**
 * Схема заклинания.
 *
 * Единственный источник и типов, и валидации: та же схема проверяет контент в CI и
 * пользовательский импорт в рантайме (ADR-0004). Инварианты — docs/domain-model.md#заклинание.
 */

import { z } from "zod";

export const CANTRIP_LEVEL = 0;
export const MAXIMUM_SPELL_LEVEL = 9;
export const MAXIMUM_CHARACTER_LEVEL = 20;

/** Минимум художественного контента на заклинание (FR-050). */
export const MINIMUM_COMPLETE_VARIANTS = 3;

/**
 * Закрытый словарь подстановок объявления мастеру (FR-041).
 * Подстановка вне списка — ошибка контента: заполнить её приложению нечем.
 */
export const ANNOUNCEMENT_PLACEHOLDERS = [
  "slotLevel",
  "spellSaveDc",
  "spellAttackModifier",
  "damage",
  "target",
  "range",
  "armorClass",
] as const;

const PLACEHOLDER_PATTERN = /\{[^}]*\}/g;

const nonEmpty = z.string().trim().min(1);

/** Минуты и часы — единственные типы, у которых число осмысленно: 1 минута ≠ 10 минут (FR-033). */
const LONG_CASTING_TYPES = ["minute", "hour"] as const;

const castingTimeSchema = z
  .object({
    type: z.enum(["action", "bonus_action", "reaction", "minute", "hour"]),
    value: z.number().int().positive().optional(),
    reactionTrigger: nonEmpty.optional(),
  })
  .refine((value) => value.type !== "reaction" || value.reactionTrigger !== undefined, {
    message: "Заклинание с временем накладывания «реакция» обязано описывать триггер",
    path: ["reactionTrigger"],
  })
  .refine(
    (value) =>
      !(LONG_CASTING_TYPES as readonly string[]).includes(value.type) || value.value !== undefined,
    {
      message: "Накладывание в минутах или часах обязано указывать число",
      path: ["value"],
    },
  )
  .refine(
    (value) =>
      (LONG_CASTING_TYPES as readonly string[]).includes(value.type) || value.value === undefined,
    {
      message: "Число ко времени накладывания «действие», «бонусное действие» и «реакция» не относится",
      path: ["value"],
    },
  );

const rangeSchema = z
  .object({
    type: z.enum(["self", "touch", "distance", "special"]),
    distanceFeet: z.number().int().positive().optional(),
  })
  .refine((value) => value.type !== "distance" || value.distanceFeet !== undefined, {
    message: "Дальность типа «distance» обязана указывать расстояние в футах",
    path: ["distanceFeet"],
  });

const areaSchema = z.object({
  shape: z.enum(["cone", "cube", "line", "sphere", "cylinder"]),
  sizeFeet: z.number().int().positive(),
});

const componentsSchema = z
  .object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    materialText: nonEmpty.optional(),
    costGp: z.number().int().positive().optional(),
    consumed: z.boolean().optional(),
  })
  .refine((value) => !value.material || value.materialText !== undefined, {
    message: "Материальный компонент обязан быть описан",
    path: ["materialText"],
  });

const durationSchema = z.object({
  type: z.enum(["instant", "rounds", "minutes", "hours", "special"]),
  value: z.number().int().positive().optional(),
});

const targetingSchema = z.object({
  // "object" добавлен вместе с первой партией контента: «Починка» и «Опознание» целятся в предмет.
  type: z.enum(["self", "creature", "creatures", "object", "point", "area"]),
  maximumTargets: z.number().int().positive().optional(),
});

const resolutionSchema = z
  .object({
    type: z.enum(["spell_attack", "saving_throw", "automatic"]),
    savingThrow: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(),
    successEffect: nonEmpty.optional(),
    failureEffect: nonEmpty.optional(),
  })
  .refine((value) => value.type !== "saving_throw" || value.savingThrow !== undefined, {
    message: "Заклинание со спасброском обязано указывать характеристику спасброска",
    path: ["savingThrow"],
  });

/** Ключи масштабирования — целые числа в строковом виде: JSON других ключей не знает. */
const scalingSchema = z.record(
  z.coerce.number().int().nonnegative(),
  nonEmpty,
);

const damageSchema = z.object({
  dice: nonEmpty,
  type: nonEmpty,
  scaling: scalingSchema.optional(),
});

/**
 * Вклад заклинания в Класс Доспеха (FR-093, ADR-0013).
 *
 * Отсутствие поля означает «к КД отношения не имеет», а не нулевой вклад: различие видно в данных
 * и не требует от движка знать список заклинаний, влияющих на защиту.
 */
export const armorClassEffectSchema = z.object({
  kind: z.enum(["base_override", "bonus"]),
  value: z.number().int().positive(),
});

const roleplaySchema = z.object({
  // Ровно одна реплика, один жест, один эффект (FR-050): список из двух склеивался в карточке
  // через « · » и читался обрывками. Разнообразие живёт в completeVariants, где оно и задумано.
  incantation: nonEmpty,
  gesture: nonEmpty,
  visualEffect: nonEmpty,
  completeVariants: z.object({
    short: z.array(nonEmpty),
    atmospheric: z.array(nonEmpty),
    sarcastic: z.array(nonEmpty),
  }),
});

const spellShape = z.object({
  id: nonEmpty,

  nameRu: nonEmpty,
  nameEn: nonEmpty,

  level: z.number().int().min(CANTRIP_LEVEL).max(MAXIMUM_SPELL_LEVEL),
  school: nonEmpty,
  source: nonEmpty.optional(),

  castingTime: castingTimeSchema,
  range: rangeSchema,
  area: areaSchema.optional(),
  components: componentsSchema,
  duration: durationSchema,

  concentration: z.boolean(),
  ritual: z.boolean(),

  targeting: targetingSchema,
  resolution: resolutionSchema,
  damage: damageSchema.optional(),
  armorClassEffect: armorClassEffectSchema.optional(),

  shortRulesRu: nonEmpty,
  fullRulesRu: nonEmpty,
  higherLevelsRu: nonEmpty.optional(),
  tacticalAdviceRu: nonEmpty.optional(),

  roleplay: roleplaySchema,
  announcementTemplate: nonEmpty,
});

/** Все художественные тексты заклинания одним списком — для проверки FR-042. */
function roleplayTexts(roleplay: z.infer<typeof roleplaySchema>): string[] {
  return [
    roleplay.incantation,
    roleplay.gesture,
    roleplay.visualEffect,
    ...roleplay.completeVariants.short,
    ...roleplay.completeVariants.atmospheric,
    ...roleplay.completeVariants.sarcastic,
  ];
}

function countCompleteVariants(roleplay: z.infer<typeof roleplaySchema>): number {
  const { short, atmospheric, sarcastic } = roleplay.completeVariants;
  return short.length + atmospheric.length + sarcastic.length;
}

export const spellSchema = spellShape.superRefine((spell, context) => {
  // Заговор не может быть ритуальным: ритуал требует уровня 1 и выше.
  if (spell.level === CANTRIP_LEVEL && spell.ritual) {
    context.addIssue({
      code: "custom",
      path: ["ritual"],
      message: "Заговор не может быть ритуальным",
    });
  }

  // FR-050: минимум три готовых варианта отыгрыша суммарно по категориям.
  if (countCompleteVariants(spell.roleplay) < MINIMUM_COMPLETE_VARIANTS) {
    context.addIssue({
      code: "custom",
      path: ["roleplay", "completeVariants"],
      message: `Нужно минимум ${MINIMUM_COMPLETE_VARIANTS} варианта отыгрыша, найдено ${countCompleteVariants(spell.roleplay)}`,
    });
  }

  // FR-041: подстановки только из закрытого словаря — остальное приложению нечем заполнить.
  const allowed = new Set<string>(ANNOUNCEMENT_PLACEHOLDERS);
  for (const token of spell.announcementTemplate.match(PLACEHOLDER_PATTERN) ?? []) {
    const placeholder = token.slice(1, -1);
    if (!allowed.has(placeholder)) {
      context.addIssue({
        code: "custom",
        path: ["announcementTemplate"],
        message: `Неизвестная подстановка «{${placeholder}}»: допустимы ${ANNOUNCEMENT_PLACEHOLDERS.join(", ")}`,
      });
    }
  }

  // FR-042: техническая формулировка не содержит художественного текста.
  const template = spell.announcementTemplate;
  for (const text of roleplayTexts(spell.roleplay)) {
    if (template.includes(text)) {
      context.addIssue({
        code: "custom",
        path: ["announcementTemplate"],
        message: `Объявление мастеру содержит художественный текст: «${text}»`,
      });
      break;
    }
  }

  if (spell.damage?.scaling !== undefined) {
    const thresholds = Object.keys(spell.damage.scaling).map(Number);
    if (spell.level === CANTRIP_LEVEL) {
      // Для заговора ключи — пороги уровня персонажа.
      for (const threshold of thresholds) {
        if (threshold < 1 || threshold > MAXIMUM_CHARACTER_LEVEL) {
          context.addIssue({
            code: "custom",
            path: ["damage", "scaling", String(threshold)],
            message: `Порог уровня персонажа должен быть от 1 до ${MAXIMUM_CHARACTER_LEVEL}`,
          });
        }
      }
    } else {
      // Для заклинания ключи — уровни ячейки, не ниже уровня самого заклинания.
      for (const threshold of thresholds) {
        if (threshold < spell.level || threshold > MAXIMUM_SPELL_LEVEL) {
          context.addIssue({
            code: "custom",
            path: ["damage", "scaling", String(threshold)],
            message: `Уровень ячейки ${threshold} вне диапазона ${spell.level}…${MAXIMUM_SPELL_LEVEL}`,
          });
        }
      }
    }
  }
});

export type Spell = z.infer<typeof spellSchema>;
export type SpellRoleplay = z.infer<typeof roleplaySchema>;
export type ArmorClassEffect = z.infer<typeof armorClassEffectSchema>;
