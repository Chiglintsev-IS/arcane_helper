"use client";

import { useState } from "react";

import type { BagView } from "@/contract/views";
import { currencyLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
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
  const required = useRequiredNumbers();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(money.map((coin) => [coin.currency, String(coin.amount)])),
  );

  const typedMoney = money.map((coin) => {
    const text = values[coin.currency] ?? "";
    return { currency: coin.currency, text, amount: requiredFieldNumber(text) };
  });
  const nextMoney: Record<string, number> = Object.fromEntries(
    typedMoney.map((coin) => [coin.currency, coin.amount]),
  );

  return (
    <EditSheetFrame
      titleRu="Деньги"
      error={error}
      onCancel={onCancel}
      onSave={() =>
        required.ask(
          typedMoney.map((coin) => coin.amount),
          () => onSave(nextMoney),
        )
      }
    >
      {typedMoney.map((coin) => (
        <NumberField
          key={coin.currency}
          labelRu={currencyLabel(coin.currency)}
          value={coin.text}
          onChange={required.touching((value: string) =>
            setValues((current) => ({ ...current, [coin.currency]: value })),
          )}
          min={0}
          reasonRu={required.reasonOf(coin.amount)}
        />
      ))}
    </EditSheetFrame>
  );
}
