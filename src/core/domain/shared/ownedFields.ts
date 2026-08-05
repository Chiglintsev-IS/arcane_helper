/**
 * Отбор полей, которыми владеет объект-значение.
 *
 * Без него объект-значение, созданный из полного состояния персонажа, возвращал бы это состояние
 * целиком, и следующий в цепочке затирал бы правки первого. Ключи с `undefined` не попадают в результат:
 * «поля нет» и «поле пустое» — разные состояния, и различие обязано пережить пересборку.
 */
export function ownedFields<TState extends object, TKey extends keyof TState>(
  state: TState,
  keys: readonly TKey[],
): Pick<TState, TKey> {
  const owned = {} as Pick<TState, TKey>;
  for (const key of keys) {
    if (state[key] !== undefined) owned[key] = state[key];
  }
  return owned;
}
