"use client";

import { ARMOR_CATEGORIES, STAT_IDS, type ArmorCategory, type StatId } from "@/core/domain/shared/stats";
import { useState } from "react";

import type { ItemDefinition, ItemKind } from "@/core/domain/items/schema";
import { ITEM_KINDS } from "@/core/domain/items/schema";
import type { Currency } from "@/core/domain/equipment/schema";
import { CURRENCIES } from "@/core/domain/shared/schema";
import {
  ARMOR_CATEGORY_LABELS,
  CURRENCY_ABBR,
  ITEM_KIND_LABELS,
  statLabel,
} from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Одна вещь целиком: категория, заметка, цена — и прибавки, если это экипировка.
 *
 * Открывается нажатием на саму вещь в списке сумки. Запас в сумке и надетое полей здесь не имеют:
 * их меняют кнопки на строке сумки — расход, пополнение, надевание, — а поле рядом с ними
 * показывало бы число, набранное до нажатия, и сохранение возвращало бы потраченное обратно.
 */
export function ItemSheet({
  item,
  bagCount,
  wornCount,
  onSave,
  onAdjustBagCount,
  onAdjustWornCount,
  onRemove,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  item: ItemDefinition;
  /** Сколько сейчас лежит в сумке и сколько надето — только для показа рядом со счётчиками. */
  bagCount: number;
  wornCount: number;
  onSave: (item: ItemDefinition) => void;
  /** Немедленный расход и пополнение — не черновик: применяется нажатием, как кнопки на строке. */
  onAdjustBagCount: (delta: number) => void;
  onAdjustWornCount: (delta: number) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [note, setNote] = useState(item.note ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item.price === undefined ? "" : String(item.price.amount),
  );
  const [currency, setCurrency] = useState<Currency>(item.price?.currency ?? "gold");
  /**
   * Прибавки набираются по одной на величину: список величин общий, и своего словаря у шторки нет.
   * Набранное уходит владельцу как есть — ноль он не сохранит сам.
   */
  const [bonuses, setBonuses] = useState<readonly (readonly [StatId, string])[]>(
    STAT_IDS.flatMap((stat) => {
      const value = item.bonuses?.[stat];
      return value === undefined ? [] : [[stat, String(value)] as const];
    }),
  );
  const [added, setAdded] = useState<StatId>("armorClass");
  const [armorBase, setArmorBase] = useState(
    item.armor === undefined ? "" : String(item.armor.base),
  );
  const [category, setCategory] = useState<ArmorCategory | "">(item.armor?.category ?? "");

  const numbers: Record<string, number> = {};
  for (const [stat, text] of bonuses) numbers[stat] = requiredFieldNumber(text);
  // Пустая цена — вещь без цены, а не цена ноль: у находки её может не назвать и мастер.
  const amount = priceAmount.trim() === "" ? undefined : Number(priceAmount);
  // Пустая база — вещь не доспех: кольцо защищает прибавкой, а не заменой базы.
  const base = armorBase.trim() === "" ? undefined : Number(armorBase);

  return (
    <EditSheetFrame
      titleRu={item.nameRu}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          id: item.id,
          nameRu: item.nameRu,
          kind,
          ...(amount === undefined ? {} : { price: { amount, currency } }),
          ...(note.trim() === "" ? {} : { note: note.trim() }),
          bonuses: numbers,
          ...(base === undefined
            ? {}
            : { armor: { base, ...(category === "" ? {} : { category }) } }),
        })
      }
    >
      {/*
       * Запас меняется кнопками, а не полем: поле хранило бы число, набранное до расхода, и
       * сохранение возвращало бы потраченное.
       */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-400">В сумке</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Потратить один из сумки: ${item.nameRu}`}
            disabled={bagCount === 0}
            onClick={() => onAdjustBagCount(-1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
          >
            −
          </button>
          <span className="min-w-8 text-center tabular-nums">{bagCount}</span>
          <button
            type="button"
            aria-label={`Добавить один в сумку: ${item.nameRu}`}
            onClick={() => onAdjustBagCount(1)}
            className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base dark:border-slate-800"
          >
            +
          </button>
        </span>
      </div>

      {kind === "gear" ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Надето</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Снять один: ${item.nameRu}`}
              disabled={wornCount === 0}
              onClick={() => onAdjustWornCount(-1)}
              className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
            >
              −
            </button>
            <span className="min-w-8 text-center tabular-nums">{wornCount}</span>
            <button
              type="button"
              aria-label={`Надеть один: ${item.nameRu}`}
              disabled={bagCount === 0}
              onClick={() => onAdjustWornCount(1)}
              className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-base disabled:opacity-40 dark:border-slate-800"
            >
              +
            </button>
          </span>
        </div>
      ) : null}

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
          {bonuses.map(([stat, text]) => (
            <NumberField
              key={stat}
              labelRu={statLabel(stat)}
              value={text}
              onChange={(next) =>
                setBonuses(bonuses.map((row) => (row[0] === stat ? [stat, next] : row)))
              }
            />
          ))}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Добавить прибавку</span>
            <span className="flex gap-2">
              <select
                value={added}
                onChange={(event) => setAdded(statOf(event.target.value))}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
              >
                {STAT_IDS.map((stat) => (
                  <option key={stat} value={stat}>
                    {statLabel(stat)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setBonuses(
                    bonuses.some((row) => row[0] === added) ? bonuses : [...bonuses, [added, "0"]],
                  )
                }
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
              >
                Добавить
              </button>
            </span>
          </label>

          <NumberField labelRu="База КД доспеха" value={armorBase} onChange={setArmorBase} min={1} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Категория доспеха</span>
            <select
              value={category}
              onChange={(event) => setCategory(categoryOf(event.target.value))}
              className="min-h-11 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
            >
              <option value="">не названа</option>
              {ARMOR_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {ARMOR_CATEGORY_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            База — только у доспеха: у кольчуги 16, у кольца поля нет. Надетый доспех задаёт базу
            КД сам; Ловкость и прибавки считаются сверху, а во что категория обходится Ловкости —
            правило листа.
          </p>
        </>
      ) : null}

      <button
        type="button"
        aria-label={`Убрать: ${item.nameRu}`}
        disabled={bagCount > 0 || wornCount > 0}
        onClick={onRemove}
        className="min-h-11 rounded-lg border border-reaction bg-reaction/10 px-2 text-xs font-medium text-reaction-strong disabled:opacity-40 dark:text-reaction"
      >
        Убрать вещь
      </button>
      {bagCount > 0 || wornCount > 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Убрать можно, когда от вещи не остаётся ни следа: сперва потратьте запас в сумке и снимите
          надетое.
        </p>
      ) : null}
    </EditSheetFrame>
  );
}


/** Выбранное в списке — величина словаря: список из него и построен. */
function statOf(chosen: string): StatId {
  return STAT_IDS.find((stat) => stat === chosen) ?? "armorClass";
}

/** Выбранная категория; пустая строка означает «не названа», а не отсутствие выбора. */
function categoryOf(chosen: string): ArmorCategory | "" {
  return ARMOR_CATEGORIES.find((category) => category === chosen) ?? "";
}
