/**
 * Состав и порядок списка заклинаний на экране.
 *
 * Отбор живёт здесь, а не в компоненте, по той же причине, что и фильтры: список в бою и список в
 * мастере применения обязаны считаться одной функцией, иначе они разойдутся и приложению перестанут
 * верить.
 */

import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";
import type { CharacterState } from "@/core/domain/character/state";
import { CANTRIP_LEVEL, type Spell } from "@/core/domain/catalog/spell";
import type { CombatRole } from "@/core/domain/catalog/combatRole";
import type { ScreenMode } from "@/core/shared/screenMode";

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
 * Может ли персонаж сотворить заклинание в этой ситуации.
 *
 * Вне боя это заговоры, подготовленные и ритуальные записи книги: ритуал творится из книги без
 * подготовки. С началом боя ритуальный способ исчезает, и неподготовленный ритуал уходит из списка
 * вовсе — ячейкой его не сотворить; остаётся только то, что укладывается в ход.
 */
export function belongsToPlayList(spell: Spell, character: CharacterState, inFight: boolean): boolean {
  const ready =
    spell.level === CANTRIP_LEVEL || character.preparedSpellIds.includes(spell.id);
  if (inFight) return ready && castableWithinTurn(spell);
  return ready || spell.ritual;
}

/** Порядок ролей внутри одной цены: сначала чем бить, потом чем закрыться, потом всё прочее. */
const ROLE_ORDER: Record<CombatRole, number> = { offense: 0, defense: 1, other: 2 };

/**
 * Место строки в списке: сначала цена, потом роль.
 *
 * Реакции наверх не поднимаются: их ищут переключателем и кнопкой «Реакции», которая стоит вне
 * списка и видна независимо от фильтров, — а третий ключ стоил списку понятности, потому что в
 * половине случаев ключ ничего не упорядочивал.
 */
export function orderKey(traits: ActionTraits): [number, number] {
  return [traits.level, ROLE_ORDER[traits.role]];
}

/**
 * Сравнение ключей по составляющим, а не перебором с индексом: индексация потребовала бы `?? 0` на
 * элемент, который у кортежа фиксированной длины отсутствовать не может, и завела бы ветку,
 * недостижимую для теста.
 */
export function compareTraits(left: ActionTraits, right: ActionTraits): number {
  const [leftPrice, leftRole] = orderKey(left);
  const [rightPrice, rightRole] = orderKey(right);
  return leftPrice - rightPrice || leftRole - rightRole;
}

/** Порядок списка «Игры». Внутри равных ключей порядок исходный: он задан книгой. */
export function orderForPlay(spells: readonly Spell[], inFight: boolean): Spell[] {
  return [...spells].sort((left, right) =>
    compareTraits(traitsOf(left, inFight), traitsOf(right, inFight)),
  );
}

/**
 * Куда встаёт строка, заклинанием не являющаяся: «Игра» упорядочена ценой, книга — уровнем, и одна
 * проверка на оба списка поставила бы её не туда.
 */
export function positionInList(
  spells: readonly Spell[],
  traits: ActionTraits,
  mode: ScreenMode,
  inFight: boolean,
): number {
  const standsAfter =
    mode === "play"
      ? (spell: Spell) => compareTraits(traitsOf(spell, inFight), traits) > 0
      : (spell: Spell) => spell.level > traits.level;
  const index = spells.findIndex(standsAfter);
  return index === -1 ? spells.length : index;
}

/**
 * Что показывать на экране.
 *
 * «Книга» показывает весь состав в исходном порядке: там смотрят состав, а не то, чем сходить.
 * «Игра» отбирает по тому, что персонаж может сотворить сейчас, и упорядочивает ценой. Там, где
 * списка нет вовсе, он пуст.
 */
export function spellsForScreen(
  spells: readonly Spell[],
  character: CharacterState,
  mode: ScreenMode,
  inFight: boolean,
): Spell[] {
  switch (mode) {
    case "book":
      return [...spells];
    case "play":
      return orderForPlay(
        spells.filter((spell) => belongsToPlayList(spell, character, inFight)),
        inFight,
      );
    default:
      return [];
  }
}
