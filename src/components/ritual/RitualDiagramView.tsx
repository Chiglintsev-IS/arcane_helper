/**
 * Полноэкранный вид схемы ритуала (FR-192).
 *
 * Полный экран, а не блок в карточке: по схеме рисуют, и на 375 px мелкий рисунок бесполезен.
 * Прокрутки нет — схема видна целиком. Кнопки печати нет намеренно (FR-192): смысл занятия в том,
 * чтобы вести линию рукой.
 *
 * Механики вид не касается (FR-193): ничего не расходует, ничего не подтверждает, закрывается в любой
 * момент.
 */

"use client";

import { RitualDiagram } from "@/components/ritual/RitualDiagram";
import type { Spell } from "@/data/schemas/spell";

export function RitualDiagramView({ spell, onClose }: { spell: Spell; onClose: () => void }) {
  const diagram = spell.ritualDiagram;
  if (diagram === undefined) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Схема ритуала «${spell.nameRu}»`}
      className="fixed inset-0 z-30 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold leading-tight">{spell.nameRu}</h2>
          <p className="text-xs text-slate-500">Перерисуйте на лист — это и есть ритуал</p>
        </div>
        <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 p-3">
        <RitualDiagram diagram={diagram} />
        <p className="text-center text-xs italic text-slate-600 dark:text-slate-400">
          {diagram.captionRu}
        </p>
      </div>
    </section>
  );
}
