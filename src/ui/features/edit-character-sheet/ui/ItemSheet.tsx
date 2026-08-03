"use client";

import { useState } from "react";

import type { Currency, InventoryItem, ItemKind } from "@/core/domain/character/state";
import { CURRENCIES, ITEM_KINDS, MAXIMUM_COIN_AMOUNT } from "@/core/domain/character/state";
import { CURRENCY_ABBR, ITEM_KIND_LABELS } from "@/ui/entities/character/lib/labels";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Одна вещь целиком: категория, заметка, цена — и прибавки, если это экипировка.
 *
 * Открывается нажатием на саму вещь в списке сумки. Счёт и надетость полей не имеют: их меняют
 * кнопки на строке — расход, пополнение, «надето», — а поле рядом с ними показывало бы число,
 * набранное до нажатия, и сохранение возвращало бы потраченное обратно.
 */
export function ItemSheet({
  item,
  onSave,
  onRemove,
  onCancel,
}: {
  item: InventoryItem;
  onSave: (item: InventoryItem) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [note, setNote] = useState(item.note ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item.price === undefined ? "" : String(item.price.amount),
  );
  const [currency, setCurrency] = useState<Currency>(item.price?.currency ?? "gold");
  const [spellcasting, setSpellcasting] = useState(String(item.bonuses?.spellcasting ?? 0));
  const [armorClass, setArmorClass] = useState(String(item.bonuses?.armorClass ?? 0));
  const [savingThrows, setSavingThrows] = useState(String(item.bonuses?.savingThrows ?? 0));

  const numbers = {
    spellcasting: Number.parseInt(spellcasting, 10),
    armorClass: Number.parseInt(armorClass, 10),
    savingThrows: Number.parseInt(savingThrows, 10),
  };
  // Пустая цена — вещь без цены, а не цена ноль: у находки её может не назвать и мастер.
  // Number, а не parseInt: «1.5» обязано отвергнуться, а не молча стать единицей.
  const amount = priceAmount.trim() === "" ? undefined : Number(priceAmount);
  const priceValid =
    amount === undefined ||
    (Number.isInteger(amount) && amount >= 0 && amount <= MAXIMUM_COIN_AMOUNT);
  const bonusesValid =
    kind !== "gear" || Object.values(numbers).every((value) => Number.isInteger(value));
  // Пустая прибавка не хранится вовсе: верёвка не участвует в счёте Класса Доспеха.
  const contributes = Object.values(numbers).some((value) => value !== 0);

  return (
    <EditSheetFrame
      // Счёт стоит в заголовке, а не полем: его меняют расход и пополнение на строке сумки.
      titleRu={item.count === 1 ? item.nameRu : `${item.nameRu} ×${item.count}`}
      canSave={priceValid && bonusesValid}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          id: item.id,
          nameRu: item.nameRu,
          kind,
          // Надевается только экипировка: смена категории снимает вещь.
          worn: kind === "gear" ? item.worn : false,
          count: item.count,
          ...(amount === undefined ? {} : { price: { amount, currency } }),
          ...(note.trim() === "" ? {} : { note: note.trim() }),
          ...(kind === "gear" && contributes ? { bonuses: numbers } : {}),
        })
      }
    >
      <div role="radiogroup" aria-label="Категория" className="flex flex-wrap gap-1">
        {ITEM_KINDS.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={kind === choice}
            onClick={() => setKind(choice)}
            className={`min-h-11 rounded-lg border px-2 text-xs ${
              kind === choice
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {ITEM_KIND_LABELS[choice]}
          </button>
        ))}
      </div>

      <TextField labelRu="Заметка" value={note} onChange={setNote} />

      <NumberField labelRu="Цена" value={priceAmount} onChange={setPriceAmount} min={0} />
      <div role="radiogroup" aria-label="Монета цены" className="flex gap-1">
        {CURRENCIES.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={currency === choice}
            aria-label={`Монета: ${CURRENCY_ABBR[choice]}`}
            onClick={() => setCurrency(choice)}
            className={`min-h-11 min-w-11 rounded-lg border px-2 text-xs ${
              currency === choice
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {CURRENCY_ABBR[choice]}
          </button>
        ))}
      </div>

      {/* Прибавки — свойство экипировки: зелье действует, когда его пьют, а не когда несут. */}
      {kind === "gear" ? (
        <>
          <NumberField labelRu="К магии" value={spellcasting} onChange={setSpellcasting} />
          <NumberField labelRu="К защите" value={armorClass} onChange={setArmorClass} />
          <NumberField labelRu="Ко всем спасброскам" value={savingThrows} onChange={setSavingThrows} />
        </>
      ) : null}

      <button
        type="button"
        aria-label={`Убрать: ${item.nameRu}`}
        onClick={onRemove}
        className="min-h-11 rounded-lg border border-reaction bg-reaction/10 px-2 text-xs font-medium text-reaction-strong dark:text-reaction"
      >
        Убрать из сумки
      </button>
    </EditSheetFrame>
  );
}
