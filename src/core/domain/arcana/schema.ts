/**
 * Подсхема магических ресурсов: ячейки, магическое восстановление, руны и очки заклинаний.
 *
 * Пределы и инварианты контекста объявляются в нём самом. Уровни заклинаний приходят из каталога:
 * какие они бывают вообще — вопрос правил, а не ячеек.
 */

import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { MINIMUM_SPELL_LEVEL } from "@/core/domain/arcana/slots";

/**
 * Ячейка одного уровня.
 *
 * Отрицательный остаток допускается: это долг, разрешённый мастером через «Применить всё равно», и
 * запрет на него превратил бы разрешённое исключение в испорченное состояние.
 */
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
const spellSlotsSchema = z.record(
  z.coerce.number().int().min(MINIMUM_SPELL_LEVEL).max(MAXIMUM_SPELL_LEVEL),
  slotSchema,
);

/**
 * Дневной бюджет «Магического восстановления» уровнями ячеек: сколько всего и сколько осталось
 * до следующего долгого отдыха. За столом его берут частями — остаток может быть нулём без
 * долгого отдыха, а не только целиком доступен или целиком потрачен.
 */
const arcaneRecoverySchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.maximum, {
    message: "Бюджет магического восстановления не может остаться больше максимума",
    path: ["remaining"],
  });

const runesSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.maximum, {
    message: "Рун не может остаться больше максимума",
    path: ["remaining"],
  });

/**
 * Очки заклинаний: только остаток. Время создания схема не хранит — гасит их не срок, а любой
 * отмеченный час, независимо от того, когда они появились.
 */
const spellPointsSchema = z.object({
  remaining: z.number().int().nonnegative(),
});

/**
 * Был ли короткий отдых с последнего долгого.
 *
 * Признак принадлежит ресурсам: он существует только как предусловие магического восстановления и
 * ни на что другое не влияет.
 *
 * Необязательное намеренно: обязательное отвергло бы сохранения прежних версий, а обновление не
 * имеет права терять данные. `undefined` читается как «отдыха не было» — это честнее
 * молчаливого разрешения, а цена ошибки всего одно лишнее предупреждение.
 */
const shortRestSinceLongRestSchema = z.boolean().optional();

/** Поля контекста для сборки полной схемы состояния. */
export const ARCANA_FIELDS = {
  spellSlots: spellSlotsSchema,
  arcaneRecovery: arcaneRecoverySchema,
  shortRestSinceLongRest: shortRestSinceLongRestSchema,
  runes: runesSchema,
  spellPoints: spellPointsSchema,
};

const arcanaStateSchema = z.object(ARCANA_FIELDS);

export type ArcanaStateData = DeepReadonly<z.infer<typeof arcanaStateSchema>>;
