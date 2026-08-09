"use client";

import { useState } from "react";

import type { BagView } from "@/contract/views";
import { currencyLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
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
  /** Кошелёк в порядке достоинства: перечень монет стола называет владелец, а не шторка. */
  money: BagView["money"];
  onSave: (money: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(money.map((coin) => [coin.currency, String(coin.amount)])),
  );

  const nextMoney: Record<string, number> = Object.fromEntries(
    money.map((coin) => [coin.currency, requiredFieldNumber(values[coin.currency] ?? "")]),
  );

  return (
    <EditSheetFrame
      titleRu="Деньги"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave(nextMoney)}
    >
      {money.map((coin) => (
        <NumberField
          key={coin.currency}
          labelRu={currencyLabel(coin.currency)}
          value={values[coin.currency] ?? ""}
          onChange={(value) => setValues((current) => ({ ...current, [coin.currency]: value }))}
          min={0}
        />
      ))}
    </EditSheetFrame>
  );
}
