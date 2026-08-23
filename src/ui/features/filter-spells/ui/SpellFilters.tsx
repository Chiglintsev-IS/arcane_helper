/**
 * Фильтры списка заклинаний.
 *
 * Логика отбора живёт в движке правил, здесь только переключатели. Состояние каждой кнопки
 * объявлено через `aria-pressed`: нажатость не должна читаться только по цвету
 *
 * Набор один на все режимы и на обе ситуации: переключатель показывается, когда делит список, —
 * часть строк ему отвечает, часть нет. Перечня по режимам нет, потому что состав списка меняется от
 * отметки схватки, и перечень оказался бы неверен в одной из двух ситуаций.
 *
 * Исключения — два вопроса, которые задают только в «Книге»: подготовка, потому что там её и
 * меняют; цена, потому что список «Игры» уже упорядочен ценой и шкала повторяла бы его порядок.
 *
 * Из времени накладывания в «Игре» спрашивают только реакцию. Действие и бонусное — выбор своего
 * хода, и на него отвечает сама строка; реакцию ищут в чужой ход, вслед за услышанным, и вопрос
 * «чем ответить» — единственный, ради которого в бою стоит места в полосе. В «Книге» стоят все
 * три: там разбирают неспешно, и ряд не отнимает хода.
 *
 * Знак у переключателя приходит от тона, как и на строке списка: полоса переносится, но от одного
 * знака в строке она не переносится, а цвет без знака за столом при свече не носитель. Свой знак
 * называет тот переключатель, чей тон взят взаймы, — лупа поиска и отметка подготовки.
 *
 * Поиск по названию правилу деления не подчиняется и стоит в полосе всегда: имя делит список в
 * любом составе, а вопрос «где та строка» задают тем чаще, чем список длиннее.
 */

import { Magnifier } from "@/ui/shared/ui/Magnifier";
import { TONE_GLYPH, TONE_TEXT, type Tone } from "@/ui/shared/ui/tone";
import { castingTimeBadge, combatRole, levelChipLabel } from "@/ui/entities/spell/lib/format";
import type { ScreenMode } from "@/ui/shared/model/screenMode";
import { type SpellFilters as Filters, type DividingCategories } from "@/ui/features/filter-spells/model/filters";
import { toggleValue } from "@/ui/features/filter-spells/model/filters";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { RULE_MARK } from "@/ui/shared/ui/rule";

/** Порядок переключателей времени накладывания. Показываются не все — только делящие список. */
const CASTING_TIME_FILTERS = ["action", "bonus_action", "reaction"];

/** О чём из времени накладывания спрашивают, пока идёт игра. */
const CASTING_TIME_FILTERS_IN_PLAY: readonly string[] = ["reaction"];

/**
 * Роли, по которым отбирают. «Другое» переключателя не получает: оно означает «ни то, ни другое», и
 * фильтр по нему отвечал бы на вопрос, которого в бою не задают.
 */
const ROLE_FILTERS = ["offense", "defense"];

/** Имя дела: им зовётся и кнопка, и поле, которое она раскрывает. */
const SEARCH_LABEL = "Поиск по названию";

function Toggle({
  pressed,
  onClick,
  tone,
  icon,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  tone: Tone;
  /** Свой знак вместо знака тона: только там, где тон взят взаймы, а не по своему значению. */
  icon?: React.ReactNode;
  /** Произносимое имя там, где подписи нет: у кнопки со значком вместо слова. */
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...(label === undefined ? {} : { "aria-label": label })}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-[0.6875rem] font-medium ${
      pressed ? `text-ink ${SURFACE_GROUP_BARE} ${RULE_MARK[tone]}` : `text-ink-quiet ${SURFACE_CONTROL}`
      }`}
    >
      <span aria-hidden="true" className={TONE_TEXT[tone]}>
        {icon ?? TONE_GLYPH[tone]}
      </span>
      {children}
    </button>
  );
}

export function SpellFilters({
  filters,
  dividing,
  mode,
  searchOpen,
  onChange,
  onSearchToggle,
}: {
  filters: Filters;
  /**
   * Что делит текущий список. Переключатель, который нашёл бы весь список или ни одной строки, —
   * обещание отбора, которого не будет: он занимает место в полосе и ничего не меняет.
   */
  dividing: DividingCategories;
  /**
   * Режим нужен ради подготовки, цены и времени накладывания: о подготовке и цене спрашивают только
   * в «Книге», а из времени накладывания в «Игре» — только о реакции.
   */
  mode: ScreenMode;
  /** Раскрыто ли поле поиска. Держит его экран: закрывает поиск и выбранная строка списка. */
  searchOpen: boolean;
  onChange: (filters: Filters) => void;
  onSearchToggle: () => void;
}) {
  const inBook = mode === "book";
  const castingTimes = CASTING_TIME_FILTERS.filter(
    (value) =>
      dividing.castingTimes.has(value) && (inBook || CASTING_TIME_FILTERS_IN_PLAY.includes(value)),
  );
  const roles = ROLE_FILTERS.filter((value) => dividing.roles.has(value));

  return (
    <section aria-label="Фильтры">
      {/*
 Полоса переносится, а не прокручивается: переключатель за краем экрана — это переключатель,
 которого для игрока нет. Плата — второй ряд, когда набор не влез; поэтому набор и сокращён до
 вопросов, которые в этой ситуации действительно задают.
 */}
      <div className="flex flex-wrap gap-1">
        {/*
 Лупа стоит первой и без подписи. Первой — потому что остальные переключатели приходят и уходят
 вслед за составом списка, а кнопка, меняющая место под пальцем, ищется дольше, чем строка. Без
 подписи — потому что слово стоило бы полосе переноса, а перенос — той строки списка, ради
 которой экран и разгружали.
 */}
        <Toggle
          pressed={searchOpen}
          tone="muted"
          label={SEARCH_LABEL}
          icon={<Magnifier />}
          onClick={onSearchToggle}
        />
        {/*
 Поле встаёт на место переключателей — не поверх списка и не рядом с ними.

 Поверх списка оно закрывало бы найденное, то есть первую же строку, ради которой искали. Рядом
 с переключателями отняло бы у полосы ряд, а ряд над списком стоит строки списка. Место
 переключателей свободно по существу: набирающий имя не спрашивает, какие тут реакции, — он уже
 знает, что ищет, и вернёт их тем же нажатием лупы.

 Фокус забирается сразу: поле появилось нажатием, и второе нажатие ради клавиатуры стоило бы
 ровно тех секунд, ради которых поиск и заводили.
 */}
        {!searchOpen ? null : (
          <input
            type="search"
            autoFocus
            value={filters.query}
            aria-label={SEARCH_LABEL}
            placeholder="Название"
            enterKeyHint="search"
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") onSearchToggle();
            }}
            className={`min-h-11 min-w-0 grow bg-transparent px-3 text-sm outline-none ${SURFACE_CONTROL}`}
          />
        )}
        {searchOpen ? null : (
          <>
        {castingTimes.map((value) => (
          <Toggle
            key={value}
            pressed={filters.castingTimes.includes(value)}
            tone={castingTimeBadge(value).tone}
            icon={castingTimeBadge(value).icon}
            onClick={() =>
              onChange({ ...filters, castingTimes: toggleValue(filters.castingTimes, value) })
            }
          >
            {castingTimeBadge(value).label}
          </Toggle>
        ))}
        {roles.map((value) => (
          <Toggle
            key={value}
            pressed={filters.roles.includes(value)}
            tone={combatRole(value).tone}
            onClick={() => onChange({ ...filters, roles: toggleValue(filters.roles, value) })}
          >
            {combatRole(value).label}
          </Toggle>
        ))}
        {dividing.concentration ? (
          <Toggle
            pressed={filters.concentration}
            tone="concentration"
            onClick={() => onChange({ ...filters, concentration: !filters.concentration })}
          >
            Концентрация
          </Toggle>
        ) : null}
        {/*
 «Ритуал» спрашивает не про признак заклинания, а про способ: что можно сотворить ритуалом
 прямо сейчас. В бою таких строк нет вовсе, и переключатель не показывается сам — отдельного
 условия про бой для этого не нужно.
 */}
        {dividing.ritual ? (
          <Toggle
            pressed={filters.ritual}
            tone="ritual"
            onClick={() => onChange({ ...filters, ritual: !filters.ritual })}
          >
            Ритуал
          </Toggle>
        ) : null}
        {inBook ? (
          <Toggle
            pressed={filters.prepared}
            tone="muted"
            icon="✓"
            onClick={() => onChange({ ...filters, prepared: !filters.prepared })}
          >
            Подготовлено
          </Toggle>
        ) : null}
          </>
        )}
      </div>

      {/*
 Цена отбирает только в «Книге»: список «Игры» уже упорядочен ценой, и шкала повторяла бы
 его порядок, забирая ряд на экране, где ряд стоит пятой части карточки.

 Стоит она своей прокручиваемой строкой, а не в переносящейся полосе выше. Довод у переноса
 там другой: переключатель за краем экрана — переключатель, которого для игрока нет. У цены
 причина обратная: значений до пяти, они идут подряд одним рядом чисел и читаются как шкала,
 а не как набор вопросов вроде «Ритуал» или «Концентрация», — а шкалу пролистывают.
 */}
      {searchOpen || !inBook || dividing.prices.length === 0 ? null : (
        <div role="group" aria-label="Цена" className="flex flex-nowrap gap-1 overflow-x-auto">
          {dividing.prices.map((price) => (
            <Toggle
              key={price}
              pressed={filters.prices.includes(price)}
              tone="muted"
              onClick={() => onChange({ ...filters, prices: toggleValue(filters.prices, price) })}
            >
              {levelChipLabel(price)}
            </Toggle>
          ))}
        </div>
      )}
    </section>
  );
}
