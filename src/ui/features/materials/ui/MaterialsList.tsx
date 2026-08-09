"use client";

import type { CastingView, SpellRowView } from "@/contract/views";

export function MaterialsList({
  rows,
  casting,
  onToggle,
}: {
  /** Строки книги: что требует своего компонента и лежит ли он в сумке, сказала проекция. */
  rows: readonly SpellRowView[];
  /** Числа заклинателя: отсюда известно, закрыты ли дешёвые компоненты. */
  casting: CastingView;
  onToggle: (spellId: string) => void;
}) {
  const needed = rows.filter((row) => row.ownComponentRequired);
  // Про снаряжение может быть неизвестно ничего: состояние приехало из сборки, которая его не
  // знала, и список покупок тогда не показывается вовсе.
  if (casting.freeComponentsCovered === undefined || needed.length === 0) return null;

  return (
    <section aria-label="Компоненты" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Купить и носить
      </h2>
      <ul className="flex flex-col gap-1">
        {needed.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              aria-pressed={row.ownComponentCarried}
              onClick={() => onToggle(row.id)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs ${
                row.ownComponentCarried
                  ? "border-action/50 bg-action/5"
                  : "border-reaction/50 bg-reaction/5"
              }`}
            >
              <span aria-hidden="true">{row.ownComponentCarried ? "✓" : "✖"}</span>
              <span className="flex-1 leading-tight">
                <span className="font-medium">{row.nameRu}</span> —{" "}
                {row.card.material?.textRu}
                {row.card.material?.consumed === true ? " · расходуется" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Фокусировка закрывает всё остальное, и напоминать о ней в списке покупок незачем. */}
      <p className="text-xs text-slate-500">
        {casting.freeComponentsCovered
          ? "Остальные компоненты закрывает фокусировка или мешочек."
          : "Ни фокусировки, ни мешочка: остальное тоже придётся носить штучно."}
      </p>
    </section>
  );
}
