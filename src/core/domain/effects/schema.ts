/**
 * Подсхема эффектов: что действует и что держится вниманием.
 *
 * Вклад заклинания в Класс Доспеха и уровень ячейки приходят из каталога: это его словарь. Итог КД
 * эффекты по-прежнему не считают — они несут вклад данными, складывает лист.
 */

import { z } from "zod";

import { armorClassEffectSchema, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { isoDateTime, nonEmpty } from "@/core/domain/shared/schema";

const activeEffectSchema = z.object({
  id: nonEmpty,
  /** Отсутствует у эффекта, заведённого игроком вручную: статуса или чужого вклада в КД. */
  spellId: nonEmpty.optional(),
  nameRu: nonEmpty,

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

  /**
   * Роль ручного эффекта, когда она есть: поправка к КД опознаётся этим признаком, а не строкой
   * имени — переименование подписи не имеет права ломать опознание.
   */
  manualKind: z.literal("armorAdjustment").optional(),

  endConditionRu: nonEmpty,
  note: nonEmpty.optional(),
});

/** Что держится вниманием прямо сейчас. Отсутствие записи означает, что не держится ничего. */
const concentrationSchema = z
  .object({ spellId: nonEmpty, startedAt: isoDateTime })
  .optional();

/** Поля контекста для сборки полной схемы состояния. */
export const EFFECTS_FIELDS = {
  activeEffects: z.array(activeEffectSchema),
  concentration: concentrationSchema,
};

export type ActiveEffect = z.infer<typeof activeEffectSchema>;
type Concentration = z.infer<typeof concentrationSchema>;

export type EffectsState = {
  activeEffects: ActiveEffect[];
  concentration?: Concentration;
};

/**
 * Инварианты доски: концентрация и эффекты согласованы между собой.
 *
 * Проверка живёт здесь, а не у того, кто собирает состояние: концентрация без своего эффекта и
 * второй концентрационный эффект — оба про эффекты, а не про персонажа.
 */
export function refineEffects(value: EffectsState, context: z.core.$RefinementCtx): void {
  // Концентрация всегда сопровождается активным эффектом.
  if (value.concentration !== undefined) {
    const matching = value.activeEffects.find(
      (effect) => effect.isConcentration && effect.spellId === value.concentration?.spellId,
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
  const concentrationEffects = value.activeEffects.filter((effect) => effect.isConcentration);
  if (concentrationEffects.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["activeEffects"],
      message: `Одновременно активно ${concentrationEffects.length} концентрационных эффекта`,
    });
  }
}

/**
 * Состояние доски само по себе: поля и оба её инварианта.
 *
 * Полная схема состояния собирается не из этой схемы, а из `EFFECTS_FIELDS` и вызова доводчика:
 * обёртка проверки не даёт `ZodObject`, а сборке нужен именно он.
 */
export const effectsStateSchema = z.object(EFFECTS_FIELDS).superRefine(refineEffects);
