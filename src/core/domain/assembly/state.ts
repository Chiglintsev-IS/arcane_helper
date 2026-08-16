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
import { CRAFTING_FIELDS } from "@/core/domain/crafting/schema";
import { EFFECTS_FIELDS, refineEffects } from "@/core/domain/effects/schema";
import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { ITEMS_FIELDS } from "@/core/domain/items/schema";
import { refineSpellbook, SPELLBOOK_FIELDS } from "@/core/domain/spellbook/schema";
import { VITALITY_FIELDS } from "@/core/domain/vitality/schema";
import { isoDateTime } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

/** Версия формата экспорта. Файл неизвестной версии отклоняется, прежний — приводится. */
export const EXPORT_SCHEMA_VERSION = 7;

/** Поля состояния целиком: каждая строка — спред владельца, своих полей у сборки нет. */
const STATE_FIELDS = {
  ...CHARACTER_FIELDS,
  ...ARCANA_FIELDS,
  ...CRAFTING_FIELDS,
  ...EFFECTS_FIELDS,
  ...EQUIPMENT_FIELDS,
  ...ITEMS_FIELDS,
  ...SPELLBOOK_FIELDS,
  ...VITALITY_FIELDS,
};

export const characterStateSchema = z.object(STATE_FIELDS).superRefine((character, context) => {
  refineSpellbook(character, context);
  refineEffects(character, context);
});

/**
 * Принадлежит ли ключ состоянию. Спрашивают у владельца полей и объявление снимка, и приведение
 * прежних сохранений: свой список ключей разошёлся бы с этим на первой же правке контекста — и
 * приведение снимало бы не то, что отвергает объявление.
 */
export function isStateField(key: string): boolean {
  return key in STATE_FIELDS;
}

/**
 * Снимок отмены: подмножество полей состояния.
 *
 * Проверяется принадлежностью ключей, а не схемами значений, и причин две. Доводчики целого к части
 * не применимы: концентрация в снимке живёт без своего эффекта, потому что эффект в снимок не попал.
 * А умолчания дописали бы в снимок поля, которых в нём не было, — и отмена вернула бы персонажу
 * умолчание вместо прежнего значения.
 */
export const characterStatePatchSchema = z.custom<Partial<CharacterState>>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every(isStateField),
  { message: "Снимок отмены должен быть набором полей состояния" },
);

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
const UNRECORDED_KEYS: readonly (keyof CharacterStateShape)[] = [
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
];

/**
 * Поля, попадающие в снимок отмены: всё, кроме справочных.
 *
 * Выводится вычитанием, а не перечисляется руками. Ручной список требовал бы помнить про него при
 * каждом новом ресурсе, и забытая строка молча оставляла бы ресурс потраченным после отмены.
 */
export const MUTABLE_STATE_KEYS = characterStateSchema
  .keyof()
  .options.filter((key) => !UNRECORDED_KEYS.includes(key));

type CharacterStateShape = z.infer<typeof characterStateSchema>;

/** Состояние правится только новым состоянием: присваивание в поле не соберётся. */
export type CharacterState = DeepReadonly<CharacterStateShape>;
