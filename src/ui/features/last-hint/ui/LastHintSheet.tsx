/**
 * Чтение о последней подсказке и её расход.
 *
 * Приложение ведёт только запас: повод и бросок остаются столу — оно не знает, что за проверка
 * провалилась и что выпало на костях. Поэтому здесь нет ни мастера в три шага, ни подтверждения:
 * один счёт `− N +`, и он же возврат, если подсказку списали по ошибке.
 *
 * Расход попадает в лог и отменяется оттуда, как любая другая правка запаса.
 */

"use client";

import { useId } from "react";

import type { ResourcesView } from "@/contract/views";
import { LAST_HINT_SHORT_RU, LAST_HINT_SPENT_RU } from "@/ui/features/last-hint/ui/LastHintRow";
import { SURFACE_CONTROL, SURFACE_PANEL } from "@/ui/shared/ui/surface";

export function LastHintSheet({
  resources,
  onAdjust,
  onClose,
}: {
  resources: ResourcesView;
  onAdjust: (delta: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const { lastHint } = resources;
  const spent = lastHint.remaining <= 0;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-sm font-semibold">
        {lastHint.nameRu}
      </h2>

      <p className="text-xs text-ink-soft">{LAST_HINT_SHORT_RU}</p>

      {/*
       Список поводов закрыт правилом стола: проверка алхимического ремесла в него не входит, и
       строка об этом стоит здесь, а не в памяти игрока.
       */}
      <p className="text-xs text-ink-quiet">
        Повод и бросок ведёт стол: приложение считает только запас. Расход попадает в лог и
        отменяется оттуда.
      </p>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span>Осталось</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            disabled={spent}
            onClick={() => onAdjust(-1)}
            aria-label={`Потратить: ${lastHint.nameRu}`}
            className={`min-h-11 min-w-11 disabled:opacity-40 ${SURFACE_CONTROL}`}
          >
            <span aria-hidden="true">−</span>
          </button>
          <span className="w-12 text-center font-semibold tabular-nums">
            {lastHint.remaining}/{lastHint.maximum}
          </span>
          <button
            type="button"
            disabled={lastHint.remaining >= lastHint.maximum}
            onClick={() => onAdjust(1)}
            aria-label={`Вернуть: ${lastHint.nameRu}`}
            className={`min-h-11 min-w-11 disabled:opacity-40 ${SURFACE_CONTROL}`}
          >
            <span aria-hidden="true">+</span>
          </button>
        </span>
      </div>

      {spent ? <p className="text-xs font-medium text-reaction">{LAST_HINT_SPENT_RU}</p> : null}

      <button
        type="button"
        onClick={onClose}
        className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
      >
        Закрыть
      </button>
    </section>
  );
}
