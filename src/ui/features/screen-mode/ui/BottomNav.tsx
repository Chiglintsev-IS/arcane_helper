"use client";

import { useId, useState } from "react";

import { SCREEN_MODES, type ScreenMode } from "@/ui/shared/model/screenMode";
import { RULE_BLOCK, RULE_ROW, RULE_SECTION } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PAGE, SURFACE_PANEL } from "@/ui/shared/ui/surface";

const LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  play: { title: "Игра", hint: "то, чем ходят" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
  things: { title: "Вещи", hint: "надетое с защитой, счётное с деньгами и чего не хватает" },
  rest: { title: "Привал", hint: "отдых и восстановление" },
  log: { title: "Лог", hint: "что случилось, что можно отменить и где взять копию" },
  sheet: { title: "Лист", hint: "кто он: уровень, характеристики, навыки, владения" },
  crafting: { title: "Ремесло", hint: "что узнано о видах ингредиентов" },
  notes: { title: "Заметки", hint: "записанное о мире: места, имена, обещания" },
};

const MODES = "Режимы";

const NOW = "сейчас";

const CLOSE = "Закрыть";

export function BottomNav({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const titleId = useId();
  const current = LABELS[mode];

  return (
    <>
      {!listOpen ? null : (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`fixed inset-0 z-20 flex flex-col ${SURFACE_PAGE}`}
        >
          <h2
            id={titleId}
            className={`shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent ${RULE_SECTION}`}
          >
            {MODES}
          </h2>

          <div className="flex min-h-0 flex-1 flex-col">
            {SCREEN_MODES.map((value) => (
              <button
                key={value}
                type="button"
                aria-current={value === mode ? "page" : undefined}
                onClick={() => {
                  onChange(value);
                  setListOpen(false);
                }}
                className={`flex flex-1 items-center gap-3 px-3 text-left ${RULE_ROW} ${
                  value === mode ? `${SURFACE_GROUP_BARE} ${RULE_BLOCK}` : ""
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`text-sm font-semibold ${value === mode ? "text-accent" : ""}`}
                  >
                    {LABELS[value].title}
                  </span>
                  <span className="text-xs text-ink-quiet">{LABELS[value].hint}</span>
                </span>
                {value === mode ? (
                  <span className="shrink-0 text-xs text-accent">{NOW}</span>
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setListOpen(false)}
            className={`h-[54px] shrink-0 px-3 text-sm text-ink-quiet ${SURFACE_PANEL}`}
          >
            {CLOSE}
          </button>
        </section>
      )}

      {/*
       Панель держит системный отступ снизу сама: домашняя полоса iPhone лежит внутри `dvh`, и без
       него кнопка уходила бы под неё.
       */}
      <nav
        aria-label="Режим экрана"
        className={`shrink-0 pb-[env(safe-area-inset-bottom)] ${SURFACE_PANEL}`}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={listOpen}
          aria-label={`${current.title}: ${current.hint}. ${MODES}`}
          onClick={() => setListOpen(true)}
          className="flex h-[54px] w-full items-center gap-2 px-3 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{current.title}</span>
            <span className="truncate text-[0.625rem] text-ink-quiet">{current.hint}</span>
          </span>
          <span className="ml-auto shrink-0 text-xs text-accent">{MODES}</span>
        </button>
      </nav>
    </>
  );
}
