/**
 * Признаки строки списка, общие для заклинания и для действия, заклинанием не являющегося.
 *
 * Существует ради «Магии крови»: она стоит в том же списке, тратит то же действие и обязана
 * отзываться на те же переключатели. Пока фильтры принимали только заклинание, строка молча
 * оставалась на экране при любом фильтре — список говорил «вот всё, что подходит», и врал.
 */

import type { Spell } from "@/core/domain/catalog/spell";
import { combatRoleOf, type CombatRole } from "@/core/domain/catalog/combatRole";
import { ritualAvailable } from "@/core/application/casting/castOptions";
import { CANTRIP_LEVEL } from "@/core/domain/arcana/slots";

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

/**
 * Цена строки — самый дешёвый способ сотворить её прямо сейчас.
 *
 * Поэтому вне боя ритуал стоит ноль: ритуальный способ ячейки не требует. С началом боя он из
 * перечня способов уходит, и то же заклинание стоит свой уровень. Повышаемое стоит наименьший
 * уровень, а не наибольший: платить больше — выбор игрока, а не цена.
 */
export function priceOf(spell: Spell, inFight: boolean): number {
  if (spell.level === CANTRIP_LEVEL) return 0;
  return ritualAvailable(spell, inFight) ? 0 : spell.level;
}

export function traitsOf(spell: Spell, inFight: boolean): ActionTraits {
  return {
    castingTime: spell.castingTime.type,
    level: priceOf(spell, inFight),
    concentration: spell.concentration,
    role: combatRoleOf(spell),
  };
}
