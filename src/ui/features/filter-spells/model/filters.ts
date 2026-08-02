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
  /** 0 — заговоры, далее уровни заклинаний. */
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

/** Часть отбора, не требующая знать, что строка — заклинание: время, роль, концентрация. */
export function matchesTraits(traits: ActionTraits, filters: SpellFilters): boolean {
  if (filters.castingTimes.length > 0 && !filters.castingTimes.some((v) => v === traits.castingTime)) {
    return false;
  }
  if (filters.roles.length > 0 && !filters.roles.includes(traits.role)) return false;
  if (filters.concentration && !traits.concentration) return false;
  return true;
}

/**
 * Полный отбор строки, заклинанием не являющейся.
 *
 * Отдельно от `matchesTraits`, потому что ту зовут и для заклинаний: поле уровня у заклинания
 * означает его уровень, а у «Магии крови» — цену в ячейках, и отбор по уровню внутри общей функции
 * отсёк бы заклинания их собственным фильтром.
 *
 * «Подготовлено» строку не прячет: подготовка к обмену не относится вовсе. «Ритуал» и уровень
 * прячут: обмен не ритуал, и уровня заклинания у него нет.
 */
export function matchesActionRow(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesTraits(traits, filters)) return false;
  if (filters.ritual) return false;
  if (filters.levels.length > 0) return false;
  return true;
}

/** Готово ли заклинание к сотворению без подготовки: заговоры — всегда. */
function isReady(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL || character.preparedSpellIds.includes(spell.id);
}

function matchesLevel(spell: Spell, filters: SpellFilters): boolean {
  if (filters.levels.length === 0) return true;
  return filters.levels.includes(spell.level);
}

function matches(spell: Spell, filters: SpellFilters, context: FilterContext): boolean {
  if (!matchesTraits(traitsOf(spell), filters)) return false;
  if (!matchesLevel(spell, filters)) return false;
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
