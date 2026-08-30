/**
 * Полнота записи следует из прохода по списку, но накопителю её не доказать: `Object.fromEntries`
 * теряет тип ключа, и другого способа выразить это у языка нет.
 */
export function recordOf<TKey extends string, TValue>(
  keys: readonly TKey[],
  value: (key: TKey) => TValue,
): Record<TKey, TValue> {
  return Object.fromEntries(keys.map((key) => [key, value(key)] as const)) as Record<TKey, TValue>;
}
