/**
 * Режимы экрана (F-18).
 *
 * Экран один, а ситуаций три, и они хотят разного: в бою — то, что творится внутри хода; на привале
 * — долгое накладывание, ритуалы и отдых; в книге — всё подряд, для чтения и сверки.
 *
 * Отбор живёт здесь, а не в компоненте, по той же причине, что и фильтры: список в бою и список в
 * мастере применения обязаны считаться одной функцией, иначе они разойдутся, и приложению перестанут
 * верить (FR-002).
 */

import type { Spell } from "@/data/schemas/spell";

export const SCREEN_MODES = ["combat", "camp", "book"] as const;

export type ScreenMode = (typeof SCREEN_MODES)[number];

/** Начальный режим: за столом приложение чаще всего открывают в бою (FR-204). */
export const DEFAULT_SCREEN_MODE: ScreenMode = "combat";

/** Виды времени накладывания, укладывающиеся в один ход. */
const WITHIN_TURN = new Set<Spell["castingTime"]["type"]>(["action", "bonus_action", "reaction"]);

/**
 * Творится ли заклинание внутри хода.
 *
 * Граница проходит по времени накладывания, а не по «боевому» смыслу: «Починка» за минуту в бою не
 * успевает независимо от того, насколько она полезна.
 */
export function castableWithinTurn(spell: Spell): boolean {
  return WITHIN_TURN.has(spell.castingTime.type);
}

/**
 * Место заклинания в режиме.
 *
 * Ритуальное заклинание попадает и в бой, и на привал, когда творится действием: в бою оно доступно
 * за ячейку, на привале — ритуалом за лишние 10 минут (FR-208). Это одно заклинание с двумя
 * способами, а не два разных.
 */
export function belongsToMode(spell: Spell, mode: ScreenMode): boolean {
  switch (mode) {
    case "combat":
      return castableWithinTurn(spell);
    case "camp":
      return !castableWithinTurn(spell) || spell.ritual;
    default:
      return true;
  }
}

/** Заклинания режима в исходном порядке: сортировка — дело списка, не отбора. */
export function spellsForMode(spells: readonly Spell[], mode: ScreenMode): Spell[] {
  return spells.filter((spell) => belongsToMode(spell, mode));
}
