/**
 * Фильтрация списка заклинаний.
 *
 * Правило комбинирования одно: значения внутри категории соединяются «или», категории между собой —
 * «и». Пустая категория ничего не ограничивает, поэтому список без фильтров показывает всё.
 *
 * Фильтр «доступно сейчас» не повторяет логику доступности, а читает её вердикт из строки: он
 * посчитан там же, где и причина, которую покажет мастер применения. Расхождение фильтра и мастера —
 * та ошибка, которая заставляет игрока перестать доверять приложению.
 */

import type { SpellRowView } from "@/contract/views";

import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";

export type SpellFilters = {
  castingTimes: string[];
  /** Цена в ячейках: 0 — «Без ячейки», далее уровни. Отбирают по цене, а не по виду строки. */
  prices: number[];
  roles: string[];
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  availableNow: boolean;
  /** Часть названия. Пустая строка не ограничивает — правило пустой категории общее. */
  query: string;
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
  query: "",
};

/** Что из категорий делит текущий список: только это и показывается переключателями. */
export type DividingCategories = {
  castingTimes: ReadonlySet<string>;
  prices: number[];
  roles: ReadonlySet<string>;
  concentration: boolean;
  ritual: boolean;
};

/**
 * Название в том виде, в каком его набирают на телефоне: без разницы в регистре и без «ё».
 *
 * «Ё» лежит под удержанием клавиши «е», и набирают её редко: «полет» обязан находить «Полёт», иначе
 * поиск отвечает пустым списком на верно названное заклинание.
 */
function searchable(value: string): string {
  return value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
}

/** Совпадение по названию. Пустой запрос совпадает со всем: это пустая категория, а не отказ. */
function matchesName(nameRu: string, query: string): boolean {
  const sought = searchable(query);
  return sought === "" || searchable(nameRu).includes(sought);
}

/** Часть отбора, общая для заклинания и для строки, заклинанием не являющейся. */
export function matchesTraits(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesName(traits.nameRu, filters.query)) return false;
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

/**
 * Категории, которые делят список: часть строк им отвечает, часть — нет.
 *
 * Перечня категорий по режимам нет намеренно. Состав списка меняется от отметки схватки, и любой
 * заранее записанный перечень оказался бы неверен в одной из двух ситуаций; переключатель же,
 * который находит весь список или ни одной строки, ничего не отбирает и только занимает полосу.
 */
export function dividingCategories(spells: readonly SpellRowView[]): DividingCategories {
  const divides = (count: number): boolean => count > 0 && count < spells.length;
  const countOf = (predicate: (spell: SpellRowView) => boolean): number =>
    spells.filter(predicate).length;
  const valuesDividing = <T>(pick: (spell: SpellRowView) => T): Set<T> =>
    new Set(
      [...new Set(spells.map(pick))].filter((value) => divides(countOf((s) => pick(s) === value))),
    );

  return {
    castingTimes: valuesDividing((spell) => spell.castingTime.type),
    prices: [...valuesDividing((spell) => spell.slotPrice)].sort((a, b) => a - b),
    roles: valuesDividing((spell) => spell.role),
    concentration: divides(countOf((spell) => spell.concentration)),
    ritual: divides(countOf((spell) => spell.ritualAvailable)),
  };
}

function matches(spell: SpellRowView, filters: SpellFilters): boolean {
  if (!matchesTraits(traitsOf(spell), filters)) return false;
  if (filters.ritual && !spell.ritualAvailable) return false;
  // «Подготовлено» не скрывает заговоры: они не готовятся, но доступны всегда.
  if (filters.prepared && !spell.prepared) return false;
  if (filters.availableNow && spell.unavailable) return false;
  return true;
}

/** Отфильтрованный список в исходном порядке: контент упорядочен по уровню, затем по алфавиту. */
export function filterSpells(
  spells: readonly SpellRowView[],
  filters: SpellFilters,
): SpellRowView[] {
  return spells.filter((spell) => matches(spell, filters));
}

/** Переключение значения внутри категории фильтров. */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
