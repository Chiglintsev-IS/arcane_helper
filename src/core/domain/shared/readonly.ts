export type DeepReadonly<TValue> = TValue extends readonly (infer TItem)[]
  ? readonly DeepReadonly<TItem>[]
  : TValue extends object
    ? { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
    : TValue;
