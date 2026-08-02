/**
 * Карточка активной концентрации в шапке экрана боя.
 *
 * Три строки вместо названия: что держится, как работает, чем сорвётся. Больше в нескролящуюся
 * шапку не влезает, остальное — в листе по тапу.
 *
 * Без концентрации карточки нет вовсе: строка «Концентрации нет» занимала ряд нескролящейся шапки
 * ради сообщения об отсутствии, а место в ней стоит дороже.
 *
 * Компонент презентационный: текст приходит готовым из `describeConcentration`.
 */

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";

export function ConcentrationCard({
  summary,
  armorClassNote,
  onOpen,
}: {
  summary: ConcentrationSummary | null;
  /** Вклад эффекта в КД: « · КД 17» или пустая строка. */
  armorClassNote: string;
  onOpen: () => void;
}) {
  if (summary === null) return null;

  return (
    <section aria-label="Концентрация" className="text-xs">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Концентрация: ${summary.nameRu}. Подробнее`}
        className="min-h-11 w-full rounded-lg border border-concentration/50 bg-concentration/10 p-2 text-left"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-concentration-strong dark:text-concentration">
            <span aria-hidden="true">✦</span> {summary.nameRu}
          </span>
          <span className="shrink-0 text-[0.625rem] text-slate-600 dark:text-slate-400">
            {summary.slotLabel} · {summary.startLabel}
            {armorClassNote} <span aria-hidden="true">›</span>
          </span>
        </span>
        <span className="block">{summary.mechanicsLabel}</span>
        <span className="block text-slate-700 dark:text-slate-300">{summary.breakLabel}</span>
      </button>
    </section>
  );
}
