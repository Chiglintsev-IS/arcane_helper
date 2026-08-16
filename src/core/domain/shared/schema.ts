/**
 * Примитивы схем, общие для контекстов.
 *
 * Здесь только формы, у которых нет одного владельца: непустая строка и метка времени — способ
 * записи, а не правило игры.
 */

import { z } from "zod";

import { DomainError } from "./errors";

const russianLocaleError = z.locales.ru().localeError;

/**
 * Название типа по-русски — там, где готовый словарь zod его не переводит и называет типом
 * библиотеки прямо внутри русской фразы: сам он переводит только число, массив и NaN.
 *
 * Границу словаря задаёт не полнота, а применение: переводится то, чем описаны данные этого
 * приложения, и то, что может принести испорченный или чужой файл, — иначе причина отказа выходит к
 * игроку наполовину латиницей. Тип за этой границей остаётся словом библиотеки: назвать его как есть
 * честнее, чем выдумать перевод, которого игрок не найдёт ни в приложении, ни в вопросе о нём.
 */
const TYPE_LABELS_RU: Record<string, string> = {
  nan: "NaN",
  number: "число",
  int: "целое число",
  string: "строка",
  boolean: "логическое значение",
  array: "массив",
  object: "объект",
  record: "набор полей",
  null: "пустое значение",
  undefined: "отсутствие значения",
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
 * Причина отказа объявления — по-русски целиком, а не наполовину словом библиотеки: у неверного типа
 * переведены обе половины фразы, ожидаемое и полученное, у предела величины — название типа;
 * остальное отдано готовому русскому словарю как есть. Передаётся каждым разбором схемы владельца, а
 * не разом всем zod: смена языка библиотеки на глобальную не должна задевать чужой код, который её
 * зовёт.
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

/**
 * Монеты стола: золото, серебро, медь. Платину и электрум стол не использует — решение игрока.
 *
 * Общая у кошелька и у цены вещи: снаряжение и вещи друг о друге не знают, и объявить словарь монет
 * в одном из них значило бы завести между ними ребро ради самого словаря, а не ради факта, который
 * у него один владелец.
 */
export const CURRENCIES = ["gold", "silver", "copper"] as const;

/**
 * Отвергает значение, не прошедшее объявление, — с причиной словами.
 *
 * Одна функция на все контексты: разбор схемы и текст отказа — способ проверки, а не правило игры,
 * и дублировать его в каждом контексте значило бы разойтись в формулировке при первой же правке.
 */
export function parsedOrRefused<TValue>(schema: z.ZodType<TValue>, value: unknown, subject: string): TValue {
  const result = schema.safeParse(value, { error: russianSchemaErrors });
  if (result.success) return result.data;
  const reasons = result.error.issues
    .map((issue) => `поле «${issue.path.join(".")}»: ${issue.message}`)
    .join("; ");
  throw new DomainError(`Не годится ${subject} — ${reasons}`);
}
