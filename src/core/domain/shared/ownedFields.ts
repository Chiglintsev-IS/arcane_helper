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
