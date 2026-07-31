/**
 * Фильтры боевого списка (FR-002, FR-003).
 *
 * Логика отбора живёт в движке правил, здесь только переключатели. Состояние каждой кнопки
 * объявлено через `aria-pressed`: нажатость не должна читаться только по цвету
 * (ux.md#доступность).
 */

import {
  CASTING_TIME,
  TONE_CLASS,
  levelLabel,
  type CastingTimeType,
} from "@/components/spell/format";
import { toggleValue, type CastingTimeFilter, type SpellFilters as Filters } from "@/rules/filters";

/** Порядок переключателей времени накладывания. Показываются не все — только имеющиеся в книге. */
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
  available,
  onChange,
  onReset,
}: {
  filters: Filters;
  /**
   * Что вообще встречается в книге. Переключатель, который не может найти ни одного заклинания, —
   * обещание несуществующего: он занимает место в полосе и всегда возвращает пустой список
   * (FR-002).
   */
  available: {
    castingTimes: ReadonlySet<CastingTimeType>;
    levels: number[];
    concentration: boolean;
    ritual: boolean;
  };
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const castingTimes = CASTING_TIME_FILTERS.filter((value) => available.castingTimes.has(value));

  return (
    <section aria-label="Фильтры">
      {/*
        Одна полоса с горизонтальной прокруткой. Второй ряд забирал у списка 48 пикселей из 568 —
        больше, чем треть карточки, — а набор переключателей и так сузился: он строится из режима.
      */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {castingTimes.map((value) => (
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
        {available.concentration ? (
          <Toggle
            pressed={filters.concentration}
            tone="concentration"
            icon="✦"
            onClick={() => onChange({ ...filters, concentration: !filters.concentration })}
          >
            Концентрация
          </Toggle>
        ) : null}
        {available.ritual ? (
          <Toggle
            pressed={filters.ritual}
            tone="ritual"
            icon="❖"
            onClick={() => onChange({ ...filters, ritual: !filters.ritual })}
          >
            Ритуал
          </Toggle>
        ) : null}
        {available.levels.map((level) => (
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
