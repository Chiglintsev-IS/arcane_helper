"use client";

import { useState } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";
import { currencyAbbr, itemKindLabel, statLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { StatPicker } from "./StatPicker";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

type ItemPatch = {
  id: string;
  nameRu: string;
  kinds: string[];
  price?: { amount: number; currency: string };
  note?: string;
  bonuses: Record<string, number>;
  worksCarried?: true;
  spellcastingFocus?: true;
};

const GEAR = "gear";

const NAME_LABEL = "Название";

const NOTE_LABEL = "Заметка";

const WANTED_LABEL = "Хочу купить";

const FOCUS_LABEL = "Фокусировка";

const FOCUS_HINT = "Надетой ею проводят магию: компоненты без стоимости она закрывает";

const NO_KINDS_HINT = "Другое: пока неизвестно, что это";

function Chip({
  labelRu,
  pressed,
  onPress,
}: {
  labelRu: string;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={`min-h-11 px-2 text-xs ${
        pressed ? `${SURFACE_CHOSEN} font-medium` : `text-ink-quiet ${SURFACE_CONTROL}`
      }`}
    >
      {labelRu}
    </button>
  );
}

function Counter({
  labelRu,
  countRu,
  count,
  lessLabelRu,
  moreLabelRu,
  lessDisabled,
  moreDisabled,
  onAdjust,
  onSet,
}: {
  labelRu: string;
  countRu: string;
  count: number;
  lessLabelRu: string;
  moreLabelRu: string;
  lessDisabled: boolean;
  moreDisabled: boolean;
  onAdjust: (delta: number) => void;
  /** Счёт, который бывает большим, набирают числом: тридцать две штуки по одной не нажимают. */
  onSet?: (count: number) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  const commit = (): void => {
    if (typed === null || onSet === undefined) return;
    const value = requiredFieldNumber(typed);
    setTyped(null);
    if (!Number.isNaN(value) && value !== count) onSet(value);
  };

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-ink-quiet">{labelRu}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={lessLabelRu}
          disabled={lessDisabled}
          onClick={() => onAdjust(-1)}
          className={`min-h-11 min-w-11 text-base disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          −
        </button>
        {onSet === undefined ? (
          <span aria-label={countRu} className="min-w-8 text-center tabular-nums">
            {count}
          </span>
        ) : (
          <input
            type="number"
            inputMode="numeric"
            aria-label={labelRu}
            value={typed ?? String(count)}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
            className={`min-h-11 w-16 px-2 text-center text-base tabular-nums ${SURFACE_CONTROL}`}
          />
        )}
        <button
          type="button"
          aria-label={moreLabelRu}
          disabled={moreDisabled}
          onClick={() => onAdjust(1)}
          className={`min-h-11 min-w-11 text-base disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          +
        </button>
      </span>
    </div>
  );
}

export function ItemSheet({
  item,
  choices,
  onSave,
  onToggleWanted,
  onAdjustBagCount,
  onSetBagCount,
  onAdjustWornCount,
  onRemove,
  onCancel,
  error = null,
}: {
  error?: string | null;
  item: ItemView;
  choices: ChoicesView;
  onSave: (item: ItemPatch) => void;
  onToggleWanted: () => void;
  onAdjustBagCount: (delta: number) => void;
  onSetBagCount: (count: number) => void;
  onAdjustWornCount: (delta: number) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const required = useRequiredNumbers();
  const [nameRu, setNameRu] = useState(item.nameRu);
  const [kinds, setKinds] = useState<readonly string[]>(item.kinds);
  const [carriedChoice, setCarriedChoice] = useState<boolean | null>(
    item.worksCarried ? true : null,
  );
  const [note, setNote] = useState(item.note ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item.price === undefined ? "" : String(item.price.amount),
  );
  const [currency, setCurrency] = useState(item.price?.currency ?? choices.currencies[0] ?? "");
  const [bonuses, setBonuses] = useState<readonly (readonly [string, string])[]>(
    item.bonuses.map((bonus) => [bonus.stat, String(bonus.value)] as const),
  );
  const [picking, setPicking] = useState(false);
  const [focus, setFocus] = useState(item.spellcastingFocus);

  const { bagCount, wornCount } = item;
  const wearable = kinds.includes(GEAR);
  const worksCarried = carriedChoice ?? !wearable;

  const typedBonuses = bonuses.map(([stat, text]) => ({
    stat,
    text,
    value: requiredFieldNumber(text),
  }));
  const numbers: Record<string, number> = Object.fromEntries(
    typedBonuses
      .filter((bonus) => required.typed(bonus.value))
      .map((bonus) => [bonus.stat, bonus.value]),
  );
  const amount = priceAmount.trim() === "" ? undefined : Number(priceAmount);

  const addBonuses = (added: readonly string[]): void => {
    setPicking(false);
    setBonuses([
      ...bonuses,
      ...added
        .filter((stat) => !bonuses.some((row) => row[0] === stat))
        .map((stat) => [stat, "0"] as const),
    ]);
  };

  const toggleKind = (kind: string): void => {
    setKinds(kinds.includes(kind) ? kinds.filter((one) => one !== kind) : [...kinds, kind]);
  };

  return (
    <>
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
                nameRu,
                kinds: [...kinds],
                ...(amount === undefined ? {} : { price: { amount, currency } }),
                ...(note.trim() === "" ? {} : { note: note.trim() }),
                bonuses: numbers,
                ...(worksCarried && bonuses.length > 0 ? { worksCarried: true } : {}),
                ...(wearable && focus ? { spellcastingFocus: focus } : {}),
              }),
          )
        }
      >
        <TextField labelRu={NAME_LABEL} value={nameRu} onChange={setNameRu} wide />

        <Counter
          labelRu="В сумке"
          countRu={`В сумке ${bagCount}`}
          count={bagCount}
          lessLabelRu={`Потратить один из сумки: ${item.nameRu}`}
          moreLabelRu={`Добавить один в сумку: ${item.nameRu}`}
          lessDisabled={bagCount === 0}
          moreDisabled={false}
          onAdjust={onAdjustBagCount}
          onSet={onSetBagCount}
        />

        {!item.kinds.includes(GEAR) ? null : (
          <Counter
            labelRu="Надето"
            countRu={`Надето ${wornCount}`}
            count={wornCount}
            lessLabelRu={`Снять один: ${item.nameRu}`}
            moreLabelRu={`Надеть один: ${item.nameRu}`}
            lessDisabled={wornCount === 0}
            moreDisabled={bagCount === 0}
            onAdjust={onAdjustWornCount}
          />
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-quiet">Признаки</span>
          <div aria-label="Признаки" className="flex flex-wrap gap-1">
            {choices.itemKinds.map((choice) => (
              <Chip
                key={choice}
                labelRu={itemKindLabel(choice)}
                pressed={kinds.includes(choice)}
                onPress={() => toggleKind(choice)}
              />
            ))}
            <Chip
              labelRu={FOCUS_LABEL}
              pressed={focus}
              onPress={() => {
                setFocus(!focus);
                if (!focus && !wearable) setKinds([...kinds, GEAR]);
              }}
            />
            <Chip labelRu={WANTED_LABEL} pressed={item.wanted} onPress={onToggleWanted} />
          </div>
          {kinds.length === 0 ? <p className="text-xs text-ink-quiet">{NO_KINDS_HINT}</p> : null}
          {focus ? <p className="text-xs text-ink-quiet">{FOCUS_HINT}</p> : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-quiet">Прибавки</span>
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
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={`min-h-11 px-3 text-sm font-medium text-action ${SURFACE_CONTROL}`}
          >
            Добавить прибавку
          </button>
          <p className="text-xs text-ink-quiet">
            Нулевая прибавка снимается. Всё, что зависит от обстановки или требует броска, — заметка:
            в числа листа она не входит, бросаете и считаете сами.
          </p>
        </div>

        {bonuses.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-ink-quiet">Прибавка действует</span>
            <div role="radiogroup" aria-label="Прибавка действует" className="flex gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={!worksCarried}
                onClick={() => setCarriedChoice(false)}
                className={`min-h-11 flex-1 px-2 text-xs ${
                  worksCarried ? `text-ink-quiet ${SURFACE_CONTROL}` : `${SURFACE_CHOSEN} font-medium`
                }`}
              >
                надетой
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={worksCarried}
                onClick={() => setCarriedChoice(true)}
                className={`min-h-11 flex-1 px-2 text-xs ${
                  worksCarried ? `${SURFACE_CHOSEN} font-medium` : `text-ink-quiet ${SURFACE_CONTROL}`
                }`}
              >
                при себе
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-quiet">{NOTE_LABEL}</span>
          <GrowingField
            labelRu={NOTE_LABEL}
            value={note}
            onChange={setNote}
            onSubmit={setNote}
          />
        </div>

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
              className={`min-h-11 min-w-11 px-2 text-xs ${
                currency === choice
                ? `${SURFACE_CHOSEN} font-medium`
                : `text-ink-quiet ${SURFACE_GROUP_BARE}`
              }`}
            >
              {currencyAbbr(choice)}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label={`Убрать: ${item.nameRu}`}
          disabled={bagCount > 0 || wornCount > 0}
          onClick={onRemove}
          className={`min-h-11 px-2 text-xs font-medium text-reaction disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          Убрать вещь
        </button>
        {bagCount > 0 || wornCount > 0 ? (
          <p className="text-xs text-ink-quiet">
            Убрать можно, когда от вещи не остаётся ни следа: сперва потратьте запас в сумке и снимите
            надетое.
          </p>
        ) : null}
      </EditSheetFrame>

      {!picking ? null : (
        <StatPicker
          stats={choices.stats}
          taken={bonuses.map((row) => row[0])}
          onPick={(stat) => addBonuses([stat])}
          onPickFamily={addBonuses}
          onCancel={() => setPicking(false)}
        />
      )}
    </>
  );
}
