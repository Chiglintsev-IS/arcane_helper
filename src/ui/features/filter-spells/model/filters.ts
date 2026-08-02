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
import type { CombatRole } from "@/core/domain/catalog/combatRole";
import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";
import { CANTRIP_LEVEL } from "@/core/domain/arcana/slots";

/** Время накладывания как фильтр: минуты и часы в бою не выбирают. */
export type CastingTimeFilter = TurnResource;

export type SpellFilters = {
  castingTimes: CastingTimeFilter[];
  /** Цена в ячейках: 0 — «Без ячейки», далее уровни. Отбирают по цене, а не по виду строки. */
  levels: number[];
  roles: CombatRole[];
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  availableNow: boolean;
};

/** Ничего не выбрано. */
export const NO_FILTERS: SpellFilters = {
  castingTimes: [],
  levels: [],
  roles: [],
  concentration: false,
  ritual: false,
  prepared: false,
  availableNow: false,
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
  if (filters.levels.length > 0 && !filters.levels.includes(traits.level)) return false;
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

function matches(spell: Spell, filters: SpellFilters, context: FilterContext): boolean {
  if (!matchesTraits(traitsOf(spell), filters)) return false;
  if (filters.ritual && !spell.ritual) return false;
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
