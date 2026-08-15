"use client";

import { useState } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";
import {
  armorCategoryLabel,
  currencyAbbr,
  itemKindLabel,
  statLabel,
} from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Одна вещь целиком: категория, заметка, цена — и прибавки, если это экипировка.
 *
 * Открывается нажатием на саму вещь в списке сумки. Запас в сумке и надетое полей здесь не имеют:
 * их меняют кнопки на строке сумки — расход, пополнение, надевание, — а поле рядом с ними
 * показывало бы число, набранное до нажатия, и сохранение возвращало бы потраченное обратно.
 */
/** Вещь так, как её набирают: то же, чем она приехала, — без запаса и надетого. */
type ItemPatch = {
  id: string;
  nameRu: string;
  kind: string;
  price?: { amount: number; currency: string };
  note?: string;
  bonuses: Record<string, number>;
  armor?: { base: number; category?: string };
  spellcastingFocus?: true;
};

export function ItemSheet({
  item,
  choices,
  onSave,
  onAdjustBagCount,
  onAdjustWornCount,
  onRemove,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  /** Вещь со своим запасом: что это такое и сколько её у персонажа — обе половины уже сведены. */
  item: ItemView;
  /** Из чего выбирают: категории, монеты и величины — перечнями правил. */
  choices: ChoicesView;
  onSave: (item: ItemPatch) => void;
  /** Немедленный расход и пополнение — не черновик: применяется нажатием, как кнопки на строке. */
  onAdjustBagCount: (delta: number) => void;
  onAdjustWornCount: (delta: number) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const required = useRequiredNumbers();
  const [kind, setKind] = useState(item.kind);
  const [note, setNote] = useState(item.note ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item.price === undefined ? "" : String(item.price.amount),
  );
  // Монета вещи без цены — первая из предложенных: перечень идёт по достоинству, и старшая в нём
  // первая. Пустой перечень оставил бы поле без выбора, и назвать монету было бы нечем.
  const [currency, setCurrency] = useState(
    item.price?.currency ?? choices.currencies[0] ?? "",
  );
  /**
   * Прибавки набираются по одной на величину: список величин общий, и своего словаря у шторки нет.
   * Набранное уходит владельцу как есть — ноль он не сохранит сам.
   */
  const [bonuses, setBonuses] = useState<readonly (readonly [string, string])[]>(
    item.bonuses.map((bonus) => [bonus.stat, String(bonus.value)] as const),
  );
  const [added, setAdded] = useState(choices.stats[0]?.id ?? "");
  const [armorBase, setArmorBase] = useState(
    item.armor === undefined ? "" : String(item.armor.base),
  );
  const [category, setCategory] = useState(item.armor?.category ?? "");
  const [focus, setFocus] = useState(item.spellcastingFocus);

  const { bagCount, wornCount } = item;

  const typedBonuses = bonuses.map(([stat, text]) => ({
    stat,
    text,
    value: requiredFieldNumber(text),
  }));
  const numbers: Record<string, number> = Object.fromEntries(
    typedBonuses.map((bonus) => [bonus.stat, bonus.value]),
  );
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
        required.ask(
          typedBonuses.map((bonus) => bonus.value),
          () =>
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
              ...(focus ? { spellcastingFocus: focus } : {}),
            }),
        )
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
        {choices.itemKinds.map((choice) => (
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
            {itemKindLabel(choice)}
          </button>
        ))}
      </div>

      <TextField labelRu="Заметка" value={note} onChange={setNote} />

      <NumberField labelRu="Цена" value={priceAmount} onChange={setPriceAmount} min={0} />
      <div role="radiogroup" aria-label="Монета цены" className="flex gap-1">
        {choices.currencies.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={currency === choice}
            aria-label={`Монета: ${currencyAbbr(choice)}`}
            onClick={() => setCurrency(choice)}
            className={`min-h-11 min-w-11 rounded-lg border px-2 text-xs ${
              currency === choice
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {currencyAbbr(choice)}
          </button>
        ))}
      </div>

      {/* Прибавки, база и фокусировка — свойства экипировки: зелье действует, когда его пьют. */}
      {kind === "gear" ? (
        <>
          <button
            type="button"
            aria-pressed={focus}
            onClick={() => setFocus(!focus)}
            className={`min-h-11 rounded-lg border px-2 text-xs ${
              focus
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            Магическая фокусировка
          </button>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Надетая фокусировка закрывает материальные компоненты без указанной стоимости. Снимете —
            компоненты снова понадобятся.
          </p>

          {typedBonuses.map((bonus) => (
            <NumberField
              key={bonus.stat}
              labelRu={statLabel(choices.stats, bonus.stat)}
              value={bonus.text}
              onChange={required.touching((next: string) =>
                setBonuses(bonuses.map((row) => (row[0] === bonus.stat ? [bonus.stat, next] : row))),
              )}
              reasonRu={required.reasonOf(bonus.value)}
            />
          ))}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Добавить прибавку</span>
            <span className="flex gap-2">
              <select
                value={added}
                onChange={(event) => setAdded(event.target.value)}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
              >
                {choices.stats.map((stat) => (
                  <option key={stat.id} value={stat.id}>
                    {statLabel(choices.stats, stat.id)}
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
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
            >
              <option value="">не названа</option>
              {choices.armorCategories.map((option) => (
                <option key={option} value={option}>
                  {armorCategoryLabel(option)}
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
