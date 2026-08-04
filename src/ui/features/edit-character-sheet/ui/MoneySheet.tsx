"use client";

import { useState } from "react";

import type { Currency, Money } from "@/core/domain/equipment/schema";
import { CURRENCIES, MAXIMUM_COIN_AMOUNT } from "@/core/domain/equipment/schema";
import { CURRENCY_LABELS } from "@/ui/entities/character/lib/labels";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/**
 * Кошелёк: три монеты стола — золото, серебро, медь, — каждая своим полем.
 *
 * Правится итогом, а не приходом и расходом: за столом монеты пересчитывают («осталось 215 зм»),
 * а арифметику сделки делает игрок — приложение не знает курса сделки и торга.
 */
export function MoneySheet({
  money,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  money: Money;
  onSave: (money: Money) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<Currency, string>>({
    gold: String(money.gold),
    silver: String(money.silver),
    copper: String(money.copper),
  });

  // Number, а не parseInt: «12.5» обязано отвергнуться, а не молча стать двенадцатью.
  // Пустое поле — не ноль, а незаполненное: Number("") молча дал бы ноль.
  const parsed = CURRENCIES.map(
    (currency) =>
      [currency, values[currency].trim() === "" ? Number.NaN : Number(values[currency])] as const,
  );

  return (
    <EditSheetFrame
      titleRu="Деньги"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave(Object.fromEntries(parsed) as Money)}
    >
      {CURRENCIES.map((currency) => (
        <NumberField
          key={currency}
          labelRu={CURRENCY_LABELS[currency]}
          value={values[currency]}
          onChange={(value) => setValues((current) => ({ ...current, [currency]: value }))}
          min={0}
        />
      ))}
    </EditSheetFrame>
  );
}
