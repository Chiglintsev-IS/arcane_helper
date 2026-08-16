"use client";

import { useId, useState } from "react";

import { type ScreenMode } from "@/ui/shared/model/screenMode";
import { SURFACE_CONTROL, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/**
 * Подсказки не содержат слова «заклинания»: список на экране назван им же, и доступное имя кнопки
 * совпадало бы с ним по подстроке — поиск по метке находил бы вместе со списком и каждую ячейку.
 *
 * Боя среди режимов нет: он состояние игры, и отмечают его кнопкой внутри «Игры».
 */
const LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  play: { title: "Игра", hint: "то, чем ходят" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
  things: { title: "Вещи", hint: "надетое с защитой, счётное с деньгами и чего не хватает" },
  rest: { title: "Привал", hint: "отдых и восстановление" },
  journal: { title: "Журнал", hint: "что случилось, что можно отменить и где взять копию" },
  sheet: { title: "Лист", hint: "кто он: уровень, характеристики, навыки, владения" },
  crafting: { title: "Ремесло", hint: "что узнано о видах ингредиентов" },
};

/** Своей ячейкой стоит то, что за столом спрашивают чаще всего. */
const OWN_CELL: ScreenMode[] = ["play", "book", "things", "rest", "journal"];

/** Остальное приходит списком: место в панели конечно, а режимов будет больше. */
const UNDER_MORE: ScreenMode[] = ["sheet", "crafting"];

const MORE = "Ещё";

/** Выбранная ячейка помечена подложкой своего значения — тем же способом, что и всё выбранное. */
function cellClass(selected: boolean): string {
  return `flex min-h-11 min-w-0 items-center justify-center rounded-lg px-0.5 text-xs font-medium ${
    selected
      ? "bg-action/20 text-action-strong dark:text-action-bright"
      : "text-slate-600 dark:text-slate-400"
  }`;
}

export function BottomNav({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const titleId = useId();

  // «Ещё» отмечен, пока показан режим из-под него: иначе панель отвечала бы, что не показано ничего.
  const moreSelected = UNDER_MORE.includes(mode);

  return (
    <>
      {!listOpen ? null : (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-2xl p-3 ${SURFACE_PANEL}`}
        >
          <h2 id={titleId} className="text-base font-semibold">
            {MORE}
          </h2>

          {UNDER_MORE.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onChange(value);
                setListOpen(false);
              }}
              className={`flex min-h-11 flex-col items-start rounded-xl px-3 py-2 text-left ${SURFACE_CONTROL}`}
            >
              <span className="text-sm font-semibold">{LABELS[value].title}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {LABELS[value].hint}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setListOpen(false)}
            className={`min-h-11 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
          >
            Закрыть
          </button>
        </section>
      )}

      {/*
       Панель держит системный отступ снизу сама: домашняя полоса iPhone лежит внутри `dvh`, и без
       него нижний ряд ячеек уходил бы под неё.
       */}
      <nav
        aria-label="Режим экрана"
        className={`shrink-0 pb-[env(safe-area-inset-bottom)] ${SURFACE_CONTROL}`}
      >
        <div className="grid grid-cols-6 p-1">
          {OWN_CELL.map((value) => (
            <button
              key={value}
              type="button"
              aria-current={value === mode ? "page" : undefined}
              aria-label={`${LABELS[value].title}: ${LABELS[value].hint}`}
              onClick={() => onChange(value)}
              className={cellClass(value === mode)}
            >
              <span className="truncate">{LABELS[value].title}</span>
            </button>
          ))}

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={listOpen}
            aria-current={moreSelected ? "page" : undefined}
            aria-label={`${MORE}: ${UNDER_MORE.map((value) => LABELS[value].title).join(", ")}`}
            onClick={() => setListOpen(true)}
            className={cellClass(moreSelected)}
          >
            <span className="truncate">{MORE}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
