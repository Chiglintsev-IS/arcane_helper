/**
 * Список записей журнала: единственное место, где отменяют, и единственный вход к данным.
 *
 * Список плоский и свежее сверху: отменяемая запись всегда первая и не требует прокрутки. Кнопка
 * возврата стоит только на ней — отменяется лишь последнее действие, а кнопка на остальных записях
 * была бы обещанием несуществующего.
 *
 * Возврат назван не отменой: отменой закрывают шторку, ничего не изменив, и один корень на два
 * разных дела за столом читается как одно.
 *
 * Отменённая запись не исчезает молча: на её месте встаёт строка о возвращённом, и кнопка возврата
 * следующей записи оказывается ниже точки прошлого нажатия. Слова строке даёт сама запись — экран
 * пересказывает случившееся её словами, а не своими.
 *
 * Компонент презентационный: записи приходят параметром, отмена и выгрузка — обратными вызовами.
 * Удалась ли отмена, он узнаёт по записям: отклонённая оставляет запись на месте, и обещать тогда
 * нечего.
 */

"use client";

import { useState } from "react";

import type { Snapshot } from "@/contract/snapshot";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/**
 * Время записи как «ЧЧ:ММ». Дата не показывается: журнал глубиной 100 живёт одну игру за столом, а
 * второй строкой на iPhone SE платят ничем не оправданной подробностью.
 */
function timeRu(at: string): string {
  const at_ = new Date(at);
  const hours = `${at_.getHours()}`.padStart(2, "0");
  const minutes = `${at_.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function Journal({
  entries,
  onUndo,
  onData,
}: {
  /** Записи в порядке хранения: старое первым, как их держит журнал. */
  entries: Snapshot["journal"];
  onUndo: () => void;
  /** Выгрузка и загрузка: копию делают, разбирая случившееся, а не выбирая, чем сходить. */
  onData: () => void;
}) {
  const newestFirst = [...entries].reverse();

  const [asked, setAsked] = useState<{ id: string; summaryRu: string } | null>(null);
  const returned = asked !== null && entries.every((entry) => entry.id !== asked.id) ? asked : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onData}
        className={`min-h-11 self-start rounded-xl px-3 text-sm font-medium ${SURFACE_CONTROL}`}
      >
        Данные
      </button>

      {returned === null ? null : (
        <div
          role="status"
          className={`flex flex-col gap-1 rounded-lg p-2 ${SURFACE_GROUP}`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Вернулось
          </span>
          <span className="text-sm leading-tight">{returned.summaryRu}</span>
        </div>
      )}

      {newestFirst.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Пока ничего не произошло.</p>
      ) : (
        <ul aria-label="Журнал событий" className="flex flex-col gap-2">
          {newestFirst.map((entry, index) => (
            <li
              key={entry.id}
              className={`flex flex-col gap-1 rounded-lg p-2 ${SURFACE_GROUP}`}
            >
              <span className="text-sm leading-tight">{entry.summaryRu}</span>
              <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                {timeRu(entry.at)}
              </span>
              {index === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setAsked({ id: entry.id, summaryRu: entry.summaryRu });
                    onUndo();
                  }}
                  aria-label={`${BUTTON_LABELS.undo}: ${entry.summaryRu}`}
                  className={`min-h-11 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
                >
                  {BUTTON_LABELS.undo}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
