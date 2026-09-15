"use client";

import { useState } from "react";

import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { FieldForm } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Цену называют за одну штуку запаса: у ингредиента штука и есть порция, второй меры между ними нет. */
export const PRICE_TITLE = "Цена за одну штуку";

/** В поле монеты стоят только цифры: набранное «два золотых» — не число, а повод для молчаливого отказа. */
function digitsOf(typed: string): string {
  return typed.replaceAll(/\D/gu, "");
}

/**
 * Монеты по номиналам: золото, серебро и медь набирают рядом, потому что вещь стоит и того, и
 * другого разом. Пересчёта между монетами приложение не делает — его не делает и стол.
 */
export function CoinsEditor({
  titleRu,
  currencies,
  coins,
  onWrite,
  onCancel,
}: {
  titleRu: string;
  currencies: readonly string[];
  coins: Readonly<Record<string, number>>;
  onWrite: (coins: Readonly<Record<string, number>>) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(currencies.map((currency) => [currency, String(coins[currency] ?? 0)])),
  );

  return (
    <FieldForm
      titleRu={titleRu}
      onWrite={() =>
        onWrite(
          Object.fromEntries(
            currencies.map((currency) => [currency, Number(typed[currency] ?? "") || 0]),
          ),
        )
      }
      onCancel={onCancel}
    >
      <div className="flex gap-1.5">
        {currencies.map((currency) => (
          <label key={currency} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[0.625rem] text-ink-quiet">{currencyAbbr(currency)}</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label={currencyAbbr(currency)}
              value={typed[currency] ?? ""}
              onChange={(event) =>
                setTyped({ ...typed, [currency]: digitsOf(event.target.value) })
              }
              className={`min-h-12 w-full px-2.5 text-right tabular-nums ${FIELD_TEXT} ${SURFACE_CONTROL}`}
            />
          </label>
        ))}
      </div>
    </FieldForm>
  );
}
