"use client";

import { SCREEN_MODES, type ScreenMode } from "@/core/shared/screenMode";

/**
 * Подсказки не содержат слова «заклинания»: список на экране назван им же, и доступное имя кнопки
 * совпадало бы с ним по подстроке — поиск по метке находил бы вместе со списком и каждую кнопку.
 *
 * Ключ `camp` держится сохранёнными состояниями; связь имени с термином — в глоссарии.
 */
const LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  combat: { title: "Бой", hint: "то, что творится внутри хода" },
  camp: { title: "Вне боя", hint: "отдых и восстановление — привал, город, дорога" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
  journal: { title: "Журнал", hint: "что случилось, что можно отменить и где взять копию" },
};

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Режим экрана"
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-0.5 dark:bg-slate-900"
    >
      {SCREEN_MODES.map((value) => {
        const selected = value === mode;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${LABELS[value].title}: ${LABELS[value].hint}`}
            onClick={() => onChange(value)}
            className={`min-h-11 shrink-0 grow basis-auto rounded-lg px-2 text-sm font-medium ${
              selected
                ? "bg-white text-action-strong shadow-sm dark:bg-slate-800 dark:text-action"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {LABELS[value].title}
          </button>
        );
      })}
    </div>
  );
}
