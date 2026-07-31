/**
 * Фильтрация боевого списка заклинаний (FR-002, FR-003).
 *
 * Правило комбинирования одно: значения внутри категории соединяются «или», категории между собой —
 * «и». Пустая категория ничего не ограничивает, поэтому список без фильтров показывает всё.
 *
 * Фильтр «доступно сейчас» не повторяет логику доступности, а вызывает `checkAvailability`
 * (FR-030): расхождение фильтра и мастера применения — та ошибка, которая заставляет игрока
 * перестать доверять приложению.
 */

import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import {
  checkAvailability,
  type Availability,
  type PaymentChoice,
  type TurnResources,
  type TurnResource,
} from "./availability";
import { MAXIMUM_PAYABLE_SPELL_LEVEL } from "./bloodMagic";
import { combatRoleOf, type CombatRole } from "./combatRole";
import { castableSlotLevels, CANTRIP_LEVEL, type CastMode } from "./slots";

/** Время накладывания как фильтр: минуты и часы в бою не выбирают. */
export type CastingTimeFilter = TurnResource;

export type SpellFilters = {
  /** Категория «время накладывания»: действие, бонусное действие, реакция. */
  castingTimes: CastingTimeFilter[];
  /** Категория «уровень»: 0 — заговоры, далее уровни заклинаний. */
  levels: number[];
  /** Категория «роль в бою»: боевое, защита, другое (FR-212, FR-213). */
  roles: CombatRole[];
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  availableNow: boolean;
};

/** Ничего не выбрано. Набор фильтров сохраняется между сессиями, но начинается отсюда (F-01). */
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

/** Способ сотворения: режим плюс оплата. Ровно то, что нужно `checkAvailability` и мастеру. */
export type CastOption = {
  mode: CastMode;
  payment: PaymentChoice;
};

/** Готово ли заклинание к сотворению без подготовки: заговоры — всегда (FR-102). */
function isReady(spell: Spell, character: CharacterState): boolean {
  return spell.level === CANTRIP_LEVEL || character.preparedSpellIds.includes(spell.id);
}

/**
 * Все способы сотворить заклинание: ячейки от собственного уровня и выше, оплата очками и
 * ритуальный режим. Наличие свободной ячейки здесь не проверяется — это дело `checkAvailability`.
 *
 * В режиме «Бой» ритуального способа среди них нет ([FR-208](../../docs/features/F-18-screen-modes.md#fr-208)):
 * ритуал занимает на 10 минут больше обычного, а раунд длится шесть секунд. Предлагать его в бою
 * значит предлагать выбор, который нельзя сделать, — и прятать за ним ячейку, которой всё решается.
 */
export function castOptions(spell: Spell, character: CharacterState): CastOption[] {
  if (spell.level === CANTRIP_LEVEL) {
    return [{ mode: "cantrip", payment: { kind: "none" } }];
  }

  const options: CastOption[] = castableSlotLevels(character.spellSlots, spell.level).map(
    (slotLevel) => ({ mode: "normal", payment: { kind: "slot", slotLevel } }),
  );

  // Очки заклинаний предлагаются, только если цена известна: таблица кровавого колдовства
  // заканчивается пятым уровнем (F-15, rules-engine.md#кровавое-колдовство).
  if (spell.level <= MAXIMUM_PAYABLE_SPELL_LEVEL) {
    options.push({ mode: "normal", payment: { kind: "spell_points" } });
  }
  if (spell.ritual && character.screenMode !== "combat") {
    options.push({ mode: "ritual", payment: { kind: "none" } });
  }
  return options;
}

/** Способ сотворения вместе с его проверкой доступности. */
export type CastPlan = { option: CastOption; availability: Availability };

/**
 * Способ, которому мешает меньше всего: доступный, если он есть, иначе с наименьшим числом
 * предупреждений. `null` — способов нет вовсе (заклинание уровня, до которого персонаж не дорос).
 *
 * Вердикт «доступно» и объяснение «почему нет» обязаны приходить из одного способа. Взять причину у
 * произвольного значит соврать: неподготовленный ритуал объяснялся бы подготовкой, хотя ритуалу она
 * не нужна (FR-103) и мастер применения предложит именно ритуал (F-02, «Причина недоступности
 * берётся у лучшего способа»).
 */
export function bestCastPlan(
  spell: Spell,
  character: CharacterState,
  turn: TurnResources,
): CastPlan | null {
  let best: CastPlan | null = null;
  for (const option of castOptions(spell, character)) {
    const availability = checkAvailability({ spell, character, turn, ...option });
    if (availability.available) return { option, availability };
    if (best === null || availability.warnings.length < best.availability.warnings.length) {
      best = { option, availability };
    }
  }
  return best;
}

/** Есть ли хоть один способ сотворить заклинание прямо сейчас (FR-002, фильтр «доступно сейчас»). */
export function canCastNow(spell: Spell, character: CharacterState, turn: TurnResources): boolean {
  return bestCastPlan(spell, character, turn)?.availability.available === true;
}

/**
 * Признаки строки списка, общие для заклинания и для действия, заклинанием не являющегося.
 *
 * Существует ради «Магии крови» ([FR-207](../../docs/features/F-18-screen-modes.md#fr-207)): она
 * стоит в том же списке, тратит то же действие и обязана отзываться на те же переключатели. Пока
 * фильтры принимали только `Spell`, строка молча оставалась на экране при любом фильтре — список
 * говорил «вот всё, что подходит», и врал.
 */
export type ActionTraits = {
  castingTime: Spell["castingTime"]["type"];
  /** Цена в ячейках: 0 — не расходует ячейку. По ней строится порядок боевого списка (FR-210). */
  level: number;
  concentration: boolean;
  role: CombatRole;
};

export function traitsOf(spell: Spell): ActionTraits {
  return {
    castingTime: spell.castingTime.type,
    level: spell.level,
    concentration: spell.concentration,
    role: combatRoleOf(spell),
  };
}

/** Часть отбора, не требующая знать, что строка — заклинание: время, роль, концентрация. */
export function matchesTraits(traits: ActionTraits, filters: SpellFilters): boolean {
  if (filters.castingTimes.length > 0 && !filters.castingTimes.some((v) => v === traits.castingTime)) {
    return false;
  }
  if (filters.roles.length > 0 && !filters.roles.includes(traits.role)) return false;
  if (filters.concentration && !traits.concentration) return false;
  return true;
}

function matchesLevel(spell: Spell, filters: SpellFilters): boolean {
  if (filters.levels.length === 0) return true;
  return filters.levels.includes(spell.level);
}

/**
 * Ритуал, который не подготовлен, в боевом списке скрыт: +10 минут накладывания делают его
 * бесполезным в бою (F-09). Показывается по фильтру «ритуал».
 */
function hiddenAsRitual(spell: Spell, filters: SpellFilters, context: FilterContext): boolean {
  return spell.ritual && !filters.ritual && !isReady(spell, context.character);
}

function matches(spell: Spell, filters: SpellFilters, context: FilterContext): boolean {
  if (hiddenAsRitual(spell, filters, context)) return false;
  if (!matchesTraits(traitsOf(spell), filters)) return false;
  if (!matchesLevel(spell, filters)) return false;
  if (filters.ritual && !spell.ritual) return false;
  // «Подготовлено» не скрывает заговоры: они не готовятся, но доступны всегда (AC-05).
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

/**
 * Сколько ритуалов скрыто правилом боевого списка. Нужно, чтобы пустой результат объяснялся
 * причиной, а не выглядел поломкой приложения (F-01).
 */
export function countHiddenRituals(
  spells: readonly Spell[],
  filters: SpellFilters,
  context: FilterContext,
): number {
  return spells.filter((spell) => hiddenAsRitual(spell, filters, context)).length;
}

/** Переключение значения внутри категории фильтров. */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
