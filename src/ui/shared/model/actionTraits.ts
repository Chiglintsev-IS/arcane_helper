/**
 * Признаки строки списка, общие для заклинания и для действия, заклинанием не являющегося.
 *
 * Существует ради «Магии крови»: она стоит в том же списке, тратит то же действие и обязана
 * отзываться на те же переключатели. Пока фильтры принимали только заклинание, строка молча
 * оставалась на экране при любом фильтре — список говорил «вот всё, что подходит», и врал.
 *
 * У заклинания эти признаки уже посчитаны — они приезжают строкой проекции; здесь остаётся форма,
 * которой и строка-не-заклинание умеет о себе рассказать.
 */

import type { SpellRowView } from "@/contract/views";

export type ActionTraits = {
  /** Как строка зовётся: по названию её и ищут, а ищут в списке целиком, а не среди заклинаний. */
  nameRu: string;
  castingTime: string;
  /** Цена в ячейках: 0 — не расходует ячейку. По ней строится и порядок списка, и отбор по цене. */
  level: number;
  concentration: boolean;
  role: string;
};

/** Имя строки обмена: её зовут так и в списке, и в мастере, и в поиске. */
export const BLOOD_MAGIC_LABEL = "Магия крови";

/** Строка «Магия крови»: обмен хитов на очки — действие в свой ход, ячейки не тратит. */
export const BLOOD_MAGIC_TRAITS: ActionTraits = {
  nameRu: BLOOD_MAGIC_LABEL,
  castingTime: "action",
  level: 0,
  concentration: false,
  role: "other",
};

/**
 * Строка последней подсказки: особенность предыстории, а не заклинание.
 *
 * Имя приходит параметром, а не набирается здесь: его называет владелец ресурса, и по нему же
 * строку находит поиск.
 *
 * Времени накладывания у неё нет вовсе: её тратят не в свой ход, а вслед за проваленной проверкой,
 * и переключатель «Действие» её не находит — это и верно, ход она не занимает. Ячейки она тоже не
 * стоит и потому стоит среди того, что ячейки не стоит.
 */
export function lastHintTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "special", level: 0, concentration: false, role: "other" };
}

export function traitsOf(spell: SpellRowView): ActionTraits {
  return {
    nameRu: spell.nameRu,
    castingTime: spell.castingTime.type,
    level: spell.slotPrice,
    concentration: spell.concentration,
    role: spell.role,
  };
}
