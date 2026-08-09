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
  castingTime: string;
  /** Цена в ячейках: 0 — не расходует ячейку. По ней строится и порядок списка, и отбор по цене. */
  level: number;
  concentration: boolean;
  role: string;
};

/** Строка «Магия крови»: обмен хитов на очки — действие в свой ход, ячейки не тратит. */
export const BLOOD_MAGIC_TRAITS: ActionTraits = {
  castingTime: "action",
  level: 0,
  concentration: false,
  role: "other",
};

export function traitsOf(spell: SpellRowView): ActionTraits {
  return {
    castingTime: spell.castingTime.type,
    level: spell.slotPrice,
    concentration: spell.concentration,
    role: spell.role,
  };
}
