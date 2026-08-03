/**
 * Признаки строки списка, общие для заклинания и для действия, заклинанием не являющегося.
 *
 * Существует ради «Магии крови»: она стоит в том же списке, тратит то же действие и обязана
 * отзываться на те же переключатели. Пока фильтры принимали только заклинание, строка молча
 * оставалась на экране при любом фильтре — список говорил «вот всё, что подходит», и врал.
 */

import type { Spell } from "@/core/domain/catalog/spell";
import { combatRoleOf, type CombatRole } from "@/core/domain/catalog/combatRole";
import { slotPriceOf } from "@/core/application/casting/castOptions";

export type ActionTraits = {
  castingTime: Spell["castingTime"]["type"];
  /** Цена в ячейках: 0 — не расходует ячейку. По ней строится и порядок списка, и отбор по цене. */
  level: number;
  concentration: boolean;
  role: CombatRole;
};

/** Строка «Магия крови»: обмен хитов на очки — действие в свой ход, ячейки не тратит. */
export const BLOOD_MAGIC_TRAITS: ActionTraits = {
  castingTime: "action",
  level: 0,
  concentration: false,
  role: "other",
};

export function traitsOf(spell: Spell, inFight: boolean): ActionTraits {
  return {
    castingTime: spell.castingTime.type,
    level: slotPriceOf(spell, inFight),
    concentration: spell.concentration,
    role: combatRoleOf(spell),
  };
}
