/**
 * Фильтры боевого списка (FR-002, FR-003).
 *
 * Логика отбора живёт в движке правил, здесь только переключатели. Состояние каждой кнопки
 * объявлено через `aria-pressed`: нажатость не должна читаться только по цвету
 * (ux.md#доступность).
 */

import { CASTING_TIME, TONE_CLASS, levelLabel } from "@/components/spell/format";
import { toggleValue, type CastingTimeFilter, type SpellFilters as Filters } from "@/rules/filters";

const CASTING_TIME_FILTERS: CastingTimeFilter[] = ["action", "bonus_action", "reaction"];

function Toggle({
  pressed,
  onClick,
  tone,
  icon,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  tone: keyof typeof TONE_CLASS;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium ${
        pressed ? TONE_CLASS[tone] : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
      }`}
    >
      {icon === undefined ? null : <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}

export function SpellFilters({
  filters,
  availableLevels,
  onChange,
  onReset,
}: {
  filters: Filters;
  /** Уровни, которые вообще есть у персонажа: пустых кнопок в бою быть не должно. */
  availableLevels: number[];
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  return (
    <section aria-label="Фильтры" className="flex flex-col gap-1">
      {/* Полоса прокручивается по горизонтали: перенос на три ряда съедал список заклинаний. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {CASTING_TIME_FILTERS.map((value) => (
          <Toggle
            key={value}
            pressed={filters.castingTimes.includes(value)}
            tone={CASTING_TIME[value].tone}
            icon={CASTING_TIME[value].icon}
            onClick={() =>
              onChange({ ...filters, castingTimes: toggleValue(filters.castingTimes, value) })
            }
          >
            {CASTING_TIME[value].label}
          </Toggle>
        ))}
        <Toggle
          pressed={filters.concentration}
          tone="concentration"
          icon="✦"
          onClick={() => onChange({ ...filters, concentration: !filters.concentration })}
        >
          Концентрация
        </Toggle>
        <Toggle
          pressed={filters.ritual}
          tone="ritual"
          icon="❖"
          onClick={() => onChange({ ...filters, ritual: !filters.ritual })}
        >
          Ритуал
        </Toggle>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {availableLevels.map((level) => (
          <Toggle
            key={level}
            pressed={filters.levels.includes(level)}
            tone="muted"
            onClick={() => onChange({ ...filters, levels: toggleValue(filters.levels, level) })}
          >
            {levelLabel(level)}
          </Toggle>
        ))}
        <Toggle
          pressed={filters.prepared}
          tone="muted"
          icon="✓"
          onClick={() => onChange({ ...filters, prepared: !filters.prepared })}
        >
          Подготовлено
        </Toggle>
        <Toggle
          pressed={filters.availableNow}
          tone="action"
          icon="⚡"
          onClick={() => onChange({ ...filters, availableNow: !filters.availableNow })}
        >
          Доступно сейчас
        </Toggle>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-slate-500 underline"
        >
          Сбросить
        </button>
      </div>
    </section>
  );
}
