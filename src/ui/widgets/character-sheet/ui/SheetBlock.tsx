"use client";

import { useState, type FormEvent } from "react";

import type { SheetBlockData, SheetRow } from "../model/rows";

/** Значение строки с подсказкой о происхождении: одинаково у факта и у сущности. */
function Value({ row }: { row: SheetRow }) {
  return (
    <span className="tabular-nums">
      {row.value}
      {row.hint === undefined ? null : (
        <span className="ml-1 text-xs text-slate-500">({row.hint})</span>
      )}
    </span>
  );
}

/**
 * Строка факта: подпись и действующее значение. Стоит парой «термин — определение», потому что она
 * и есть пара: КС спасброска — 16.
 */
function FactRow({ row }: { row: SheetRow }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-slate-600 dark:text-slate-400">{row.labelRu}</dt>
      <dd>
        <Value row={row} />
      </dd>
    </div>
  );
}

/**
 * Строка сущности: нажатие открывает её целиком. Так вещь правится там, где её видно, и блоку не
 * нужна кнопка на весь список.
 *
 * Список сущностей — перечень, а не набор пар: `dl` держит только `dt` и `dd`, и кнопка вокруг них
 * ломает разбор списка определений (axe: dlitem).
 */
function EntityRow({ row, onOpen }: { row: SheetRow; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${row.labelRu}`}
        className="flex min-h-11 w-full items-baseline justify-between gap-2 rounded-lg px-1 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span className="text-slate-600 dark:text-slate-400">{row.labelRu}</span>
        <Value row={row} />
      </button>
    </li>
  );
}

/**
 * Строка быстрого ввода блока: одно поле, отправка по «Ввод», без кнопки и без листа.
 *
 * Тем же способом, что и новый статус в блоке действующего: находку за столом заводят одним словом,
 * а подробности — количество, вид, прибавки, заметку — дописывают нажатием на саму вещь, если они
 * вообще понадобятся.
 */
function QuickAddField({ labelRu, onAdd }: { labelRu: string; onAdd: (nameRu: string) => void }) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nameRu = value.trim();
    if (nameRu === "") return;
    onAdd(nameRu);
    setValue("");
  };

  return (
    <form onSubmit={submit}>
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-800">
        <span className="shrink-0 text-slate-500 dark:text-slate-400">{labelRu}</span>
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
      </label>
    </form>
  );
}

/** Блок сущностей — тот, чьи строки открываются. Пустой список сущностей остаётся набором фактов. */
function openable(block: SheetBlockData): boolean {
  return block.rows.every((row) => row.openId !== undefined) && block.rows.length > 0;
}

export function SheetBlock({
  block,
  onEdit,
  onSecondaryEdit,
  onOpenRow,
  onQuickAdd,
}: {
  block: SheetBlockData;
  onEdit: () => void;
  onSecondaryEdit: () => void;
  onOpenRow: (openId: string) => void;
  onQuickAdd: (nameRu: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{block.titleRu}</h2>
        <div className="flex gap-1">
          {block.secondary === undefined ? null : (
            <button
              type="button"
              onClick={onSecondaryEdit}
              aria-label={`Править: ${block.secondary.labelRu}`}
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              {block.secondary.labelRu}
            </button>
          )}
          {block.editable ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Править: ${block.titleRu}`}
              className="min-h-11 min-w-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Править
            </button>
          ) : null}
        </div>
      </div>
      {/*
       * Перечень сущностей и набор фактов — разная разметка, потому что это разные вещи: у вещи
       * есть своя страница, у КС спасброска её нет. Смешивать их в одном контейнере нельзя.
       */}
      {openable(block) ? (
        <ul aria-label={block.titleRu} className="flex flex-col gap-0.5 text-sm">
          {block.rows.map((row) => (
            <EntityRow
              key={row.labelRu}
              row={row}
              onOpen={() => onOpenRow(row.openId ?? block.editId)}
            />
          ))}
        </ul>
      ) : (
        <dl className="flex flex-col gap-0.5 text-sm">
          {block.rows.map((row) => (
            <FactRow key={row.labelRu} row={row} />
          ))}
        </dl>
      )}
      {block.quickAddLabelRu === undefined ? null : (
        <QuickAddField labelRu={block.quickAddLabelRu} onAdd={onQuickAdd} />
      )}
    </section>
  );
}
