/**
 * Полное состояние персонажа: поля всех контекстов в одной схеме.
 *
 * Сборка знает каждый контекст, и её не знает ни один — иначе контексты знали бы друг друга через
 * неё. Своих правил у неё нет: поля приходят спредом от владельцев, инварианты — их доводчиками,
 * а здесь остаётся только то, что имеет смысл лишь на целом состоянии: файл выгрузки и список
 * полей, обратимых журналом.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания, лимит подготовки) проверяется отдельно в
 * integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { ARCANA_FIELDS } from "@/core/domain/arcana/schema";
import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { EFFECTS_FIELDS, refineEffects } from "@/core/domain/effects/schema";
import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { refineSpellbook, SPELLBOOK_FIELDS } from "@/core/domain/spellbook/schema";
import { VITALITY_FIELDS } from "@/core/domain/vitality/schema";
import { isoDateTime } from "@/core/domain/shared/schema";

/** Версия формата экспорта. Файл неизвестной версии отклоняется, прежний — приводится. */
export const EXPORT_SCHEMA_VERSION = 6;

export const characterStateSchema = z
  .object({
    ...CHARACTER_FIELDS,
    ...ARCANA_FIELDS,
    ...EFFECTS_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...SPELLBOOK_FIELDS,
    ...VITALITY_FIELDS,
  })
  .superRefine((character, context) => {
    refineSpellbook(character, context);
    refineEffects(character, context);
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

export type CharacterState = z.infer<typeof characterStateSchema>;
