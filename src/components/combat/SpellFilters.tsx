/**
 * Фильтры списка заклинаний (FR-002, FR-003, FR-212).
 *
 * Логика отбора живёт в движке правил, здесь только переключатели. Состояние каждой кнопки
 * объявлено через `aria-pressed`: нажатость не должна читаться только по цвету
 * (ux.md#доступность).
 *
 * Набор один на все режимы и растёт от состава списка, а не от режима: время накладывания, роль и
 * концентрация есть везде, где есть чем их наполнить. Вне боя к ним добавляются уровень,
 * ритуальность и подготовка — вопросы, которых в бою не задают (FR-212). Уровень при этом стоит не
 * в общей полосе, а в своей прокручиваемой строке — читается шкалой чисел, а не набором вопросов.
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
  // Набор один на все режимы: переключатель показывается, если в списке есть чем его наполнить, и
  // ничем больше не ограничен (FR-212). Разные наборы читались как две разные программы — замечание
  // игрока о том же, о чём и одинаковая карточка.
  const castingTimes = CASTING_TIME_FILTERS.filter((value) => available.castingTimes.has(value));
  const roles = ROLE_FILTERS.filter((value) => available.roles.has(value));
  // «Сбросить» живёт только в бою (FR-212): там полосу оглядывают под чужой ход, и снимать
  // переключатели по одному в этот момент некогда. В «Книге» их немного и время есть — кнопка
  // забирала бы место в полосе ради редкого случая. Появляется она по-прежнему, только когда есть
  // что сбрасывать: кнопка, которая ничего не делает, обещает действие (FR-002).
  const resettable =
    inCombat &&
    (filters.castingTimes.length > 0 ||
    filters.levels.length > 0 ||
    filters.roles.length > 0 ||
    filters.concentration ||
    filters.ritual ||
    filters.prepared ||
    filters.availableNow);

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
        {roles.map((value) => (
          <Toggle
            key={value}
            pressed={filters.roles.includes(value)}
            tone={COMBAT_ROLE[value].tone}
            {...(COMBAT_ROLE[value].icon === undefined ? {} : { icon: COMBAT_ROLE[value].icon })}
            onClick={() => onChange({ ...filters, roles: toggleValue(filters.roles, value) })}
          >
            {COMBAT_ROLE[value].label}
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
        {/*
          Ритуальность, уровень и подготовка добавляются к общему набору там, где они отвечают на
          вопрос: в бою ритуал творится за ячейку и от обычного заклинания неотличим (FR-208), а
          неподготовленного в списке нет вовсе (FR-209) — переключатели нашли бы весь список.
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
            <Toggle
              pressed={filters.prepared}
              tone="muted"
              icon="✓"
              onClick={() => onChange({ ...filters, prepared: !filters.prepared })}
            >
              Подготовлено
            </Toggle>
            {/*
              Переключателя «Доступно» здесь нет (FR-212). Полоса эта показывается только вне боя, а
              вне боя ход не отслеживается: действие и реакция всегда целы, ячейки на месте, — и
              «доступно» означает ровно «подготовлено». Два переключателя отбирали один список и
              стоили полосе ряда.
            */}
          </>
        )}
        {resettable ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-slate-500 underline"
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {/*
        Уровень — единственный переключатель, вынесенный в свою прокручиваемую строку, а не в
        переносящуюся полосу выше (FR-212). Довод у переноса там другой: переключатель за краем
        экрана — переключатель, которого для игрока нет, и в бою полосу не пролистывают, а
        оглядывают (см. выше). У уровня причина обратная. Уровней пять, они идут подряд одним рядом
        чисел и читаются как шкала, а не как набор вопросов вроде «Ритуал» или «Подготовлено»; в
        «Книге» их к тому же оглядывают не под чужой ход, а прокрутка — обычный способ работы со
        списком в этом режиме (FR-218). Правило боя при этом не меняется: фильтра по уровню в бою
        нет вовсе, и строки этой там тоже нет.
      */}
      {inCombat || available.levels.length === 0 ? null : (
        <div role="group" aria-label="Уровень" className="flex flex-nowrap gap-1 overflow-x-auto">
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
        </div>
      )}
    </section>
  );
}
