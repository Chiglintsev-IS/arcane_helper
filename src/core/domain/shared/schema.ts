/**
 * Примитивы схем, общие для контекстов.
 *
 * Здесь только формы, у которых нет одного владельца. Непустая строка и метка времени — способ
 * записи, а не правило игры. Прибавки — форма, общая у вещи и у прочих прибавок персонажа:
 * снаряжение и персонаж друг о друге не знают, и объявить её в одном из них значило бы завести
 * между листьями ребро.
 */

import { z } from "zod";

const russianLocaleError = z.locales.ru().localeError;

/**
 * Название типа по-русски — там, где готовый словарь zod его не переводит и называет типом
 * библиотеки прямо внутри русской фразы: подтверждено разбором `.int()`-схемы с дробным числом
 * (`ожидалось int`) и `.min()`/`.max()` с числом вне предела (`будет иметь <=999999 number`).
 */
const TYPE_LABELS_RU: Record<string, string> = {
  nan: "NaN",
  number: "число",
  int: "целое число",
  string: "строка",
  array: "массив",
};

/** Единица предела длины — только там, где предел этого контекста и бывает: символ, элемент списка. */
const SIZE_UNITS: Record<string, { one: string; few: string; many: string }> = {
  string: { one: "символ", few: "символа", many: "символов" },
  array: { one: "элемент", few: "элемента", many: "элементов" },
};

/** Множественное число русской единицы счёта — свой счётчик: готовый словарь zod его не отдаёт наружу. */
function pluralUnit(count: number, one: string, few: string, many: string): string {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
}

/** Отказ по пределу величины — тот же текст, что у словаря zod, с переведённым названием типа. */
function sizeRefusal(verdict: string, adj: string, origin: string, bound: number | bigint): string {
  const originRu = TYPE_LABELS_RU[origin] ?? origin;
  const unit = SIZE_UNITS[origin];
  if (!unit) return `${verdict}: ожидалось, что ${originRu} будет ${adj}${bound.toString()}`;
  const word = pluralUnit(Number(bound), unit.one, unit.few, unit.many);
  return `${verdict}: ожидалось, что ${originRu} будет иметь ${adj}${bound.toString()} ${word}`;
}

/**
 * Причина отказа объявления — по-русски целиком, а не наполовину словом библиотеки: готовый
 * русский словарь zod называет типом библиотеки без перевода дробное число под `.int()` и число
 * вне предела под `.min()`/`.max()` — здесь оба случая переведены, остальное отдано словарю как
 * есть. Передаётся каждым разбором схемы владельца, а не разом всем zod: смена языка библиотеки на
 * глобальную не должна задевать чужой код, который её зовёт.
 */
export const russianSchemaErrors: typeof russianLocaleError = (issue) => {
  if (issue.code === "invalid_type") {
    const expected = TYPE_LABELS_RU[issue.expected] ?? issue.expected;
    const receivedType = z.core.util.parsedType(issue.input);
    const received = TYPE_LABELS_RU[receivedType] ?? receivedType;
    return `Неверный ввод: ожидалось ${expected}, получено ${received}`;
  }
  if (issue.code === "too_big") {
    return sizeRefusal("Слишком большое значение", issue.inclusive ? "<=" : "<", issue.origin, issue.maximum);
  }
  if (issue.code === "too_small") {
    return sizeRefusal("Слишком маленькое значение", issue.inclusive ? ">=" : ">", issue.origin, issue.minimum);
  }
  return russianLocaleError(issue);
};

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
