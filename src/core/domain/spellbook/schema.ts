/**
 * Подсхема книги заклинаний: что персонаж знает, что подготовил и чем помечены варианты отыгрыша.
 *
 * Пределы и инварианты контекста объявляются в нём самом. Три инварианта книги проверяются поверх
 * всех её полей сразу, поэтому вынесены в доводчик: сборка вызывает его в своём `superRefine`, и
 * проверка остаётся одна на состояние, где бы это состояние ни собирали.
 */

import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { nonEmpty } from "@/core/domain/shared/schema";

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

/** Поля контекста для сборки полной схемы состояния. */
export const SPELLBOOK_FIELDS = {
  cantripIds: z.array(nonEmpty),
  spellbookSpellIds: z.array(nonEmpty),
  preparedSpellIds: z.array(nonEmpty),
  spellNotes: z.record(nonEmpty, nonEmpty),
  roleplayPreferences: z.record(nonEmpty, roleplayPreferenceSchema),
};

/**
 * Состояние книги само по себе: поля и три её инварианта.
 *
 * Полная схема состояния персонажа собирается не из этой схемы, а из `SPELLBOOK_FIELDS` и вызова
 * доводчика — обёртка проверки не даёт `ZodObject`, а сборке нужен именно он.
 */
const spellbookStateSchema = z.object(SPELLBOOK_FIELDS).superRefine(refineSpellbook);

export type SpellbookState = DeepReadonly<z.infer<typeof spellbookStateSchema>>;
export type RoleplayPreference = DeepReadonly<z.infer<typeof roleplayPreferenceSchema>>;

/**
 * Инварианты книги, которые видны только по нескольким полям сразу.
 *
 * Первая находка на каждый инвариант и прерывает обход: перечислять все повторы значило бы вывалить
 * игроку список там, где испорчено само состояние, а починить его всё равно нечем.
 */
export function refineSpellbook(value: SpellbookState, context: z.core.$RefinementCtx): void {
  // Идентификаторы не дублируются ни в одной коллекции.
  for (const field of ["cantripIds", "spellbookSpellIds", "preparedSpellIds"] as const) {
    const ids = value[field];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Список содержит повторяющиеся идентификаторы",
      });
    }
  }

  // Заговоры и книга заклинаний не пересекаются: заговор не занимает места в книге.
  const cantrips = new Set(value.cantripIds);
  for (const id of value.spellbookSpellIds) {
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
  const spellbook = new Set(value.spellbookSpellIds);
  for (const id of value.preparedSpellIds) {
    if (!spellbook.has(id)) {
      context.addIssue({
        code: "custom",
        path: ["preparedSpellIds"],
        message: `Подготовлено заклинание «${id}», которого нет в книге`,
      });
      break;
    }
  }
}
