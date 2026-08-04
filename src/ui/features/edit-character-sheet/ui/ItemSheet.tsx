"use client";

import { useState } from "react";

import type { Currency, InventoryItem, ItemKind } from "@/core/domain/equipment/schema";
import { CURRENCIES, ITEM_KINDS } from "@/core/domain/equipment/schema";
import { BONUS_LABELS, CURRENCY_ABBR, ITEM_KIND_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
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
  onAdjustCount,
  onRemove,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  item: InventoryItem;
  onSave: (item: InventoryItem) => void;
  /** Немедленный расход и пополнение — не черновик: применяется нажатием, как кнопки на строке. */
  onAdjustCount: (delta: number) => void;
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
  const [armorBase, setArmorBase] = useState(
    item.armorBase === undefined ? "" : String(item.armorBase),
  );

  const numbers = {
    spellcasting: requiredFieldNumber(spellcasting),
    armorClass: requiredFieldNumber(armorClass),
    savingThrows: requiredFieldNumber(savingThrows),
  };
  // Пустая цена — вещь без цены, а не цена ноль: у находки её может не назвать и мастер.
  const amount = priceAmount.trim() === "" ? undefined : Number(priceAmount);
  // Пустая база — вещь не доспех: кольцо защищает прибавкой, а не заменой базы.
  const base = armorBase.trim() === "" ? undefined : Number(armorBase);

  return (
    <EditSheetFrame
      // Счёт стоит в заголовке, а не полем: его меняют расход и пополнение на строке сумки.
      titleRu={item.count === 1 ? item.nameRu : `${item.nameRu} ×${item.count}`}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          id: item.id,
          nameRu: item.nameRu,
          kind,
          worn: item.worn,
          count: item.count,
          ...(amount === undefined ? {} : { price: { amount, currency } }),
          ...(note.trim() === "" ? {} : { note: note.trim() }),
          bonuses: numbers,
          ...(base === undefined ? {} : { armorBase: base }),
        })
      }
    >
      {/*
       * Запас меняется кнопками, а не полем: поле хранило бы число, набранное до расхода, и
       * сохранение возвращало бы потраченное. У экипировки это единственное место уменьшить стопку.
       */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-400">Запас</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Потратить один: ${item.nameRu}`}
            disabled={item.count === 0}
            onClick={() => onAdjustCount(-1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
          >
            −
          </button>
          <span className="min-w-8 text-center tabular-nums">{item.count}</span>
          <button
            type="button"
            aria-label={`Добавить один: ${item.nameRu}`}
            onClick={() => onAdjustCount(1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base dark:border-slate-800"
          >
            +
          </button>
        </span>
      </div>

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

      {/* Прибавки и база доспеха — свойства экипировки: зелье действует, когда его пьют. */}
      {kind === "gear" ? (
        <>
          <NumberField labelRu={BONUS_LABELS.spellcasting} value={spellcasting} onChange={setSpellcasting} />
          <NumberField labelRu={BONUS_LABELS.armorClass} value={armorClass} onChange={setArmorClass} />
          <NumberField labelRu={BONUS_LABELS.savingThrows} value={savingThrows} onChange={setSavingThrows} />
          <NumberField labelRu="База КД доспеха" value={armorBase} onChange={setArmorBase} min={1} />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            База — только у доспеха: у кольчуги 16, у кольца поля нет. Надетый доспех задаёт базу
            КД сам; Ловкость и прибавки считаются сверху.
          </p>
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
