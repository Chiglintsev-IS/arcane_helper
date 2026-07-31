/**
 * Фильтры списка заклинаний (FR-002, FR-003, FR-212).
 *
 * Логика отбора живёт в движке правил, здесь только переключатели. Состояние каждой кнопки
 * объявлено через `aria-pressed`: нажатость не должна читаться только по цвету
 * (ux.md#доступность).
 *
 * Набор зависит от режима. В бою спрашивают три вещи — чем это тратится, зачем это нужно и занимает
 * ли концентрацию; уровень, ритуальность и подготовка в бою не отвечают ни на один вопрос (FR-212).
 * Вне боя список длинный, и отбор по уровню там главный (FR-214).
 */

import {
  CASTING_TIME,
  COMBAT_ROLE,
  TONE_CLASS,
  levelChipLabel,
  type CastingTimeType,
} from "@/components/spell/format";
import type { CombatRole } from "@/rules/combatRole";
import { toggleValue, type CastingTimeFilter, type SpellFilters as Filters } from "@/rules/filters";
import type { ScreenMode } from "@/rules/modes";

/** Порядок переключателей времени накладывания. Показываются не все — только имеющиеся в списке. */
const CASTING_TIME_FILTERS: CastingTimeFilter[] = ["action", "bonus_action", "reaction"];

/**
 * Роли, по которым отбирают. «Другое» переключателя не получает: оно означает «ни то, ни другое», и
 * фильтр по нему отвечал бы на вопрос, которого в бою не задают.
 */
const ROLE_FILTERS: CombatRole[] = ["offense", "defense"];

/** Что вообще встречается в текущем списке: переключатель без единой находки не показывается. */
export type AvailableFilters = {
  castingTimes: ReadonlySet<CastingTimeType>;
  levels: number[];
  roles: ReadonlySet<CombatRole>;
  concentration: boolean;
  ritual: boolean;
};

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
      className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2 text-[0.6875rem] font-medium ${
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
  mode,
  onChange,
  onReset,
}: {
  filters: Filters;
  /**
   * Что встречается в списке режима. Переключатель, который не может найти ни одного заклинания, —
   * обещание несуществующего: он занимает место в полосе и всегда возвращает пустой список
   * (FR-002).
   */
  available: AvailableFilters;
  mode: ScreenMode;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const inCombat = mode === "combat";
  // Время накладывания спрашивают только в бою: вне боя ходов нет (FR-202), и «Действие» отбирало
  // бы по ресурсу, которого в этом режиме не существует, — той же неправдой, что и зелёный значок
  // потраченного действия на привале.
  const castingTimes = inCombat
    ? CASTING_TIME_FILTERS.filter((value) => available.castingTimes.has(value))
    : [];
  const roles = ROLE_FILTERS.filter((value) => available.roles.has(value));
  // «Сбросить» появляется, когда есть что сбрасывать: кнопка, которая ничего не делает, занимает
  // место в полосе и обещает действие (FR-002).
  const anySelected =
    filters.castingTimes.length > 0 ||
    filters.levels.length > 0 ||
    filters.roles.length > 0 ||
    filters.concentration ||
    filters.ritual ||
    filters.prepared ||
    filters.availableNow;

  return (
    <section aria-label="Фильтры">
      {/*
        Полоса переносится, а не прокручивается: переключатель за краем экрана — это переключатель,
        которого для игрока нет, и в бою его не ищут. Плата — второй ряд, когда набор не влез;
        поэтому набор и сокращён до вопросов, которые в этом режиме действительно задают (FR-212).
      */}
      <div className="flex flex-wrap gap-1">
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
        {inCombat
          ? roles.map((value) => (
              <Toggle
                key={value}
                pressed={filters.roles.includes(value)}
                tone={COMBAT_ROLE[value].tone}
                {...(COMBAT_ROLE[value].icon === undefined
                  ? {}
                  : { icon: COMBAT_ROLE[value].icon })}
                onClick={() => onChange({ ...filters, roles: toggleValue(filters.roles, value) })}
              >
                {COMBAT_ROLE[value].label}
              </Toggle>
            ))
          : null}
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
        {/*
          Ритуальность, уровень, подготовка и «доступно сейчас» — вопросы вне боя. В бою ритуал
          творится за ячейку и от обычного заклинания неотличим (FR-208), неподготовленного в
          списке нет (FR-209), а «доступно сейчас» прячет строку ровно тогда, когда игрок выясняет,
          чего ему не хватает: причина написана на самой строке словами (FR-212).
        */}
        {inCombat ? null : (
          <>
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
                {levelChipLabel(level)}
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
            {/* «Доступно», а не «Доступно сейчас»: вне боя «сейчас» ничего не уточняет — время
                там не идёт, — а слово стоило полосе целого ряда. */}
            <Toggle
              pressed={filters.availableNow}
              tone="action"
              icon="⚡"
              onClick={() => onChange({ ...filters, availableNow: !filters.availableNow })}
            >
              Доступно
            </Toggle>
          </>
        )}
        {anySelected ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-slate-500 underline"
          >
            Сбросить
          </button>
        ) : null}
      </div>
    </section>
  );
}
