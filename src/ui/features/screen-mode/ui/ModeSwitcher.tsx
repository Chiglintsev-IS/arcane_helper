"use client";

import { useEffect, useRef } from "react";

import { SCREEN_MODES, type ScreenMode } from "@/ui/shared/model/screenMode";

/**
 * Подсказки не содержат слова «заклинания»: список на экране назван им же, и доступное имя кнопки
 * совпадало бы с ним по подстроке — поиск по метке находил бы вместе со списком и каждую кнопку.
 *
 * Боя среди режимов нет: он состояние игры, и отмечают его кнопкой внутри «Игры».
 */
const LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  play: { title: "Игра", hint: "то, чем ходят" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
  journal: { title: "Журнал", hint: "что случилось, что можно отменить и где взять копию" },
  sheet: { title: "Лист", hint: "кто он: уровень, характеристики, навыки, владения" },
  gear: { title: "Экипировка", hint: "что надето, что про запас и во что это обходится защите" },
  bag: { title: "Сумка", hint: "счётные вещи по категориям и деньги" },
  rest: { title: "Привал", hint: "отдых, восстановление и покупки" },
};

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // Полоса прокручивается к текущему режиму сама: с семью ярлыками узкий экран все не вмещает,
  // а выбранный за краем читался бы как «режим не переключился».
  useEffect(() => {
    // Вызов необязательный: тестовый DOM прокрутки не знает, а падать из-за этого нельзя.
    selectedRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [mode]);

  return (
    <div
      role="radiogroup"
      aria-label="Режим экрана"
      className="flex flex-nowrap gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-0.5 dark:bg-slate-900"
    >
      {SCREEN_MODES.map((value) => {
        const selected = value === mode;
        return (
          <button
            key={value}
            ref={selected ? selectedRef : null}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${LABELS[value].title}: ${LABELS[value].hint}`}
            onClick={() => onChange(value)}
            className={`min-h-11 shrink-0 grow basis-auto rounded-lg px-1 text-sm font-medium ${
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
