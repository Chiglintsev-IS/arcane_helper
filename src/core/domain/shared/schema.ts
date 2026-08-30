import { z } from "zod";

import { DomainError } from "./errors";

const russianLocaleError = z.locales.ru().localeError;

/**
 * Готовый русский словарь zod переводит только число, массив и NaN, а остальные типы называет
 * словом библиотеки внутри русской фразы.
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

const SIZE_UNITS: Record<string, { one: string; few: string; many: string }> = {
  string: { one: "символ", few: "символа", many: "символов" },
  array: { one: "элемент", few: "элемента", many: "элементов" },
};

function pluralUnit(count: number, one: string, few: string, many: string): string {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
}

function sizeRefusal(verdict: string, adj: string, origin: string, bound: number | bigint): string {
  const originRu = TYPE_LABELS_RU[origin] ?? origin;
  const unit = SIZE_UNITS[origin];
  if (!unit) return `${verdict}: ожидалось, что ${originRu} будет ${adj}${bound.toString()}`;
  const word = pluralUnit(Number(bound), unit.one, unit.few, unit.many);
  return `${verdict}: ожидалось, что ${originRu} будет иметь ${adj}${bound.toString()} ${word}`;
}

const russianSchemaErrors: typeof russianLocaleError = (issue) => {
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

export function parsedBySchema<TValue>(
  schema: z.ZodType<TValue>,
  value: unknown,
): z.ZodSafeParseResult<TValue> {
  return schema.safeParse(value, { error: russianSchemaErrors });
}

export const nonEmpty = z.string().trim().min(1);

export const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Ожидается дата и время в формате ISO 8601",
});

export const CURRENCIES = ["gold", "silver", "copper"] as const;

export function parsedOrRefused<TValue>(schema: z.ZodType<TValue>, value: unknown, subject: string): TValue {
  const result = parsedBySchema(schema, value);
  if (result.success) return result.data;
  const reasons = result.error.issues
    .map((issue) => `поле «${issue.path.join(".")}»: ${issue.message}`)
    .join("; ");
  throw new DomainError(`Не годится ${subject} — ${reasons}`);
}
