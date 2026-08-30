"use client";

import { useState } from "react";

import type { BagView } from "@/contract/views";
import { currencyLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

export function MoneySheet({
  money,
  onSave,
  onCancel,
  error = null,
}: {
  error?: string | null;
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
