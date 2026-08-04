/**
 * Запись со значением на каждый ключ замкнутого списка.
 *
 * Собирается за один проход по списку, поэтому полнота записи следует из самой операции, а не из
 * обещания того, кто её вызвал: пропустить ключ здесь нечем. Накопителю такое доказать нельзя —
 * `Object.fromEntries` теряет тип ключа, и другого способа выразить полноту у языка нет.
 */
export function recordOf<TKey extends string, TValue>(
  keys: readonly TKey[],
  value: (key: TKey) => TValue,
): Record<TKey, TValue> {
  return Object.fromEntries(keys.map((key) => [key, value(key)] as const)) as Record<TKey, TValue>;
}
