import { Magnifier } from "@/ui/shared/ui/Magnifier";
import { TONE_GLYPH, TONE_TEXT, type Tone } from "@/ui/shared/ui/tone";
import { castingTimeBadge, combatRole, levelChipLabel } from "@/ui/entities/spell/lib/format";
import type { ScreenMode } from "@/ui/shared/model/screenMode";
import { type SpellFilters as Filters, type DividingCategories } from "@/ui/features/filter-spells/model/filters";
import { toggleValue } from "@/ui/features/filter-spells/model/filters";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { RULE_MARK } from "@/ui/shared/ui/rule";

const CASTING_TIME_FILTERS = ["action", "bonus_action", "reaction"];

const ROLE_FILTERS = ["offense", "defense", "other"];

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
  icon?: React.ReactNode;
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
  dividing: DividingCategories;
  mode: ScreenMode;
  searchOpen: boolean;
  onChange: (filters: Filters) => void;
  onSearchToggle: () => void;
}) {
  const inBook = mode === "book";
  const castingTimes = CASTING_TIME_FILTERS.filter((value) => dividing.castingTimes.has(value));
  const roles = ROLE_FILTERS.filter((value) => dividing.roles.has(value));

  return (
    <section aria-label="Фильтры">
      <div className="flex flex-wrap gap-1">
        <Toggle
          pressed={searchOpen}
          tone="muted"
          label={SEARCH_LABEL}
          icon={<Magnifier />}
          onClick={onSearchToggle}
        />
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
        {inBook && dividing.ritual ? (
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
