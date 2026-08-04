/**
 * Примитивы схем, общие для контекстов.
 *
 * Здесь только формы, у которых нет одного владельца. Непустая строка и метка времени — способ
 * записи, а не правило игры. Прибавки — форма, общая у вещи и у прочих прибавок персонажа:
 * снаряжение и персонаж друг о друге не знают, и объявить её в одном из них значило бы завести
 * между листьями ребро.
 */

import { z } from "zod";

/** Строка, в которой есть хоть что-то: пробелы содержимым не считаются. */
export const nonEmpty = z.string().trim().min(1);

export const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Ожидается дата и время в формате ISO 8601",
});

const itemBonus = z.number().int();

/** Прибавки к магии, защите и спасброскам: одна форма у вещи и у прочих прибавок персонажа. */
export const itemBonusesSchema = z.object({
  spellcasting: itemBonus.default(0),
  armorClass: itemBonus.default(0),
  savingThrows: itemBonus.default(0),
});

export const NO_ITEM_BONUSES = { spellcasting: 0, armorClass: 0, savingThrows: 0 };

export type ItemBonuses = z.infer<typeof itemBonusesSchema>;
