"use client";

import { useState } from "react";

import type { ArmorClassEffect } from "@/core/domain/catalog/spell";

type ContributionKind = "none" | ArmorClassEffect["kind"];

const CONTRIBUTION_LABELS: Record<ContributionKind, string> = {
  none: "Нет",
  bonus: "Прибавка",
  base_override: "Замена базы",
};

/**
 * Ручной эффект: статус, которого нет в каталоге, либо временный вклад в Класс Доспеха от союзника.
 * Заводится и снимается тем же блоком, где виден список активных эффектов.
 */
export function ManualEffectSheet({
  onConfirm,
  onCancel,
}: {
  onConfirm: (input: { nameRu: string; armorClass?: ArmorClassEffect }) => void;
  onCancel: () => void;
}) {
  const [nameRu, setNameRu] = useState("");
  const [kind, setKind] = useState<ContributionKind>("none");
  const [value, setValue] = useState("");

  const trimmedName = nameRu.trim();
  const parsedValue = Number.parseInt(value, 10);
  const contributionValid = kind === "none" || (Number.isInteger(parsedValue) && parsedValue > 0);
  const valid = trimmedName !== "" && contributionValid;

  const submit = (): void => {
    onConfirm({
      nameRu: trimmedName,
      ...(kind === "none" ? {} : { armorClass: { kind, value: parsedValue } }),
    });
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Новый эффект"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Название</span>
        <input
          type="text"
          value={nameRu}
          onChange={(event) => setNameRu(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-base dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      <div role="radiogroup" aria-label="Вклад в Класс Доспеха" className="flex gap-1">
        {(Object.keys(CONTRIBUTION_LABELS) as ContributionKind[]).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => setKind(option)}
            className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${
              kind === option
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {CONTRIBUTION_LABELS[option]}
          </button>
        ))}
      </div>

      {kind === "none" ? null : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Значение</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
          />
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={submit}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Отмена
        </button>
      </div>
    </section>
  );
}
