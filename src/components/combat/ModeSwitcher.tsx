/**
 * Переключатель режима экрана (FR-200, FR-204).
 *
 * Стоит первым и виден всегда: режим определяет, что вообще есть на экране, и не должен теряться
 * среди фильтров. Три кнопки, а не выпадающий список: за столом смотрят одним взглядом и попадают
 * одним пальцем.
 *
 * Компонент презентационный: режим приходит параметром, смена — обратным вызовом.
 */

import { SCREEN_MODES, type ScreenMode } from "@/rules/modes";

/**
 * Подсказки не содержат слова «заклинания»: список на экране назван им же, и доступное имя кнопки
 * совпадало бы с ним по подстроке — поиск по метке находил бы четыре элемента вместо одного.
 *
 * Средний режим называется «Вне боя», а не «Привал» (FR-202): вне боя бывает город, дорога и
 * разговор, и вкладку с костром в этих случаях не открывают. Ключ `camp` — прежнее название,
 * оставшееся в коде и в сохранённых состояниях; связь имён держит глоссарий.
 */
const LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  combat: { title: "Бой", hint: "то, что творится внутри хода" },
  camp: { title: "Вне боя", hint: "отдых и восстановление — привал, город, дорога" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
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
      className="flex gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-900"
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
            className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-medium ${
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
