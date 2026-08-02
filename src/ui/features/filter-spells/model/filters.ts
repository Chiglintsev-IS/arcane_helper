/**
 * Фильтрация списка заклинаний.
 *
 * Правило комбинирования одно: значения внутри категории соединяются «или», категории между собой —
 * «и». Пустая категория ничего не ограничивает, поэтому список без фильтров показывает всё.
 *
 * Фильтр «доступно сейчас» не повторяет логику доступности, а спрашивает её: расхождение фильтра и
 * мастера применения — та ошибка, которая заставляет игрока перестать доверять приложению.
 */

import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import type { TurnResource, TurnResources } from "@/core/application/casting/availability";
import { canCastNow } from "@/core/application/casting/castOptions";
import { combatRoleOf, type CombatRole } from "@/core/domain/catalog/combatRole";
import { priceOf, traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";
import { CANTRIP_LEVEL } from "@/core/domain/arcana/slots";

/** Время накладывания как фильтр: минуты и часы в бою не выбирают. */
export type CastingTimeFilter = TurnResource;

export type SpellFilters = {
  castingTimes: CastingTimeFilter[];
  /** Цена в ячейках: 0 — «Без ячейки», далее уровни. Отбирают по цене, а не по виду строки. */
  prices: number[];
  roles: CombatRole[];
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  availableNow: boolean;
};

/** Ничего не выбрано. */
export const NO_FILTERS: SpellFilters = {
  castingTimes: [],
  prices: [],
  roles: [],
  concentration: false,
  ritual: false,
  prepared: false,
  availableNow: false,
};

/** Что из категорий делит текущий список: только это и показывается переключателями. */
export type DividingCategories = {
  castingTimes: ReadonlySet<Spell["castingTime"]["type"]>;
  prices: number[];
  roles: ReadonlySet<CombatRole>;
  concentration: boolean;
  ritual: boolean;
};

export type FilterContext = {
  character: CharacterState;
  turn: TurnResources;
};

/** Часть отбора, общая для заклинания и для строки, заклинанием не являющейся. */
export function matchesTraits(traits: ActionTraits, filters: SpellFilters): boolean {
  if (filters.castingTimes.length > 0 && !filters.castingTimes.some((v) => v === traits.castingTime)) {
    return false;
  }
  if (filters.roles.length > 0 && !filters.roles.includes(traits.role)) return false;
  if (filters.concentration && !traits.concentration) return false;
  if (filters.prices.length > 0 && !filters.prices.includes(traits.level)) return false;
  return true;
}

/**
 * Полный отбор строки, заклинанием не являющейся.
 *
 * По цене она отбирается наравне с заклинаниями: «Без ячейки» ловит и заговоры, и обмен хитов на
 * очки. «Ритуал» прячет — обмен не ритуал. «Подготовлено» не прячет: подготовка к нему не
 * относится вовсе.
 */
export function matchesActionRow(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesTraits(traits, filters)) return false;
  if (filters.ritual) return false;
  return true;
}

/** Готово ли заклинание к сотворению без подготовки: заговоры — всегда. */
function isReady(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL || character.preparedSpellIds.includes(spell.id);
}

/**
 * Можно ли сотворить заклинание ритуалом прямо сейчас. В бою — нельзя ничем: ритуал занимает на
 * десять минут больше обычного.
 */
function ritualNow(spell: Spell, inFight: boolean): boolean {
  return spell.ritual && !inFight;
}

/**
 * Категории, которые делят список: часть строк им отвечает, часть — нет.
 *
 * Перечня категорий по режимам нет намеренно. Состав списка меняется от отметки схватки, и любой
 * заранее записанный перечень оказался бы неверен в одной из двух ситуаций; переключатель же,
 * который находит весь список или ни одной строки, ничего не отбирает и только занимает полосу.
 */
export function dividingCategories(
  spells: readonly Spell[],
  inFight: boolean,
): DividingCategories {
  const divides = (count: number): boolean => count > 0 && count < spells.length;
  const countOf = (predicate: (spell: Spell) => boolean): number =>
    spells.filter(predicate).length;
  const valuesDividing = <T>(pick: (spell: Spell) => T): Set<T> =>
    new Set(
      [...new Set(spells.map(pick))].filter((value) => divides(countOf((s) => pick(s) === value))),
    );

  return {
    castingTimes: valuesDividing((spell) => spell.castingTime.type),
    prices: [...valuesDividing((spell) => priceOf(spell, inFight))].sort((a, b) => a - b),
    roles: valuesDividing(combatRoleOf),
    concentration: divides(countOf((spell) => spell.concentration)),
    ritual: divides(countOf((spell) => ritualNow(spell, inFight))),
  };
}

function matches(spell: Spell, filters: SpellFilters, context: FilterContext): boolean {
  if (!matchesTraits(traitsOf(spell, context.turn.inFight), filters)) return false;
  if (filters.ritual && !ritualNow(spell, context.turn.inFight)) return false;
  // «Подготовлено» не скрывает заговоры: они не готовятся, но доступны всегда.
  if (filters.prepared && !isReady(spell, context.character)) return false;
  if (filters.availableNow && !canCastNow(spell, context.character, context.turn)) return false;
  return true;
}

/** Отфильтрованный список в исходном порядке: контент упорядочен по уровню, затем по алфавиту. */
export function filterSpells(
  spells: readonly Spell[],
  filters: SpellFilters,
  context: FilterContext,
): Spell[] {
  return spells.filter((spell) => matches(spell, filters, context));
}

/** Переключение значения внутри категории фильтров. */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
