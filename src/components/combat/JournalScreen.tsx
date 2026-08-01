/**
 * Экран журнала (FR-113) — единственное место, где отменяют (FR-114, ADR-0022).
 *
 * Список плоский и свежее сверху: отменяемая запись всегда первая и не требует прокрутки. Кнопка
 * стоит только на ней — отменяется лишь последнее действие (FR-111), а кнопка на остальных записях
 * была бы обещанием несуществующего.
 *
 * Компонент презентационный: записи приходят параметром, отмена — обратным вызовом. Состояние он не
 * трогает, как и остальные компоненты экрана (ADR-0003).
 */

import type { JournalEntry } from "@/store/session";

/**
 * Время записи как «ЧЧ:ММ». Дата не показывается: журнал глубиной 100 живёт одну игру за столом, а
 * второй строкой на iPhone SE платят ровно ничем не оправданной подробностью (FR-112).
 */
function timeRu(at: string): string {
  const at_ = new Date(at);
  const hours = `${at_.getHours()}`.padStart(2, "0");
  const minutes = `${at_.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function JournalScreen({
  entries,
  onUndo,
}: {
  /** Записи в порядке хранения: старое первым, как их держит журнал. */
  entries: readonly JournalEntry[];
  onUndo: () => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Пока ничего не произошло.</p>;
  }

  const newestFirst = [...entries].reverse();

  return (
    <ul aria-label="Журнал событий" className="flex flex-col gap-2">
      {newestFirst.map((entry, index) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
        >
          <span className="text-sm leading-tight">{entry.summaryRu}</span>
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {timeRu(entry.at)}
          </span>
          {index === 0 ? (
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Отменить: ${entry.summaryRu}`}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Отменить
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
