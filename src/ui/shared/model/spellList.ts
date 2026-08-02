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
 * Место заклинания в режиме.
 *
 * Вне боя списка нет вовсе: спешить некуда, и отбор «что успеет за ход» перестаёт что-либо значить —
 * там отдыхают, а за заклинанием идут в «Книгу». Ритуальное заклинание из-за этого не пропадает: в
 * бою оно доступно за ячейку, в «Книге» — ритуалом за лишние десять минут.
 */
export function belongsToMode(spell: Spell, mode: ScreenMode): boolean {
  switch (mode) {
    case "combat":
      return castableWithinTurn(spell);
    case "camp":
    case "journal":
    case "sheet":
      return false;
    default:
      return true;
  }
}

/** Заклинания режима в исходном порядке: сортировка — дело списка, не отбора. */
export function spellsForMode(spells: readonly Spell[], mode: ScreenMode): Spell[] {
  return spells.filter((spell) => belongsToMode(spell, mode));
}

/**
 * Заклинания, которые в бою вообще можно сотворить: заговоры и подготовленные.
 *
 * Неподготовленное — не выбор, а лишняя строка в списке, который просматривают под чужой ход.
 */
export function preparedForCombat(spells: readonly Spell[], character: CharacterState): Spell[] {
  const prepared = new Set(character.preparedSpellIds);
  return spells.filter((spell) => spell.level === CANTRIP_LEVEL || prepared.has(spell.id));
}

/** Порядок ролей внутри одной цены: сначала чем бить, потом чем закрыться, потом всё прочее. */
const ROLE_ORDER: Record<CombatRole, number> = { offense: 0, defense: 1, other: 2 };

/**
 * Место строки в боевом порядке: реакции, затем цена, затем роль.
 *
 * Реакции наверху потому, что триггер приходит в чужой ход и в любой момент, а собственное действие
 * случается раз за круг. Ключ считается по признакам строки, а не по заклинанию: в списке стоит и
 * «Магия крови», и её место определяется теми же тремя вопросами.
 */
export function combatOrderKey(traits: ActionTraits): [number, number, number] {
  return [traits.castingTime === "reaction" ? 0 : 1, traits.level, ROLE_ORDER[traits.role]];
}

/**
 * Сравнение ключей по составляющим, а не перебором с индексом: индексация потребовала бы `?? 0` на
 * элемент, который у кортежа фиксированной длины отсутствовать не может, и завела бы ветку,
 * недостижимую для теста.
 */
export function compareCombatTraits(left: ActionTraits, right: ActionTraits): number {
  const [leftGroup, leftLevel, leftRole] = combatOrderKey(left);
  const [rightGroup, rightLevel, rightRole] = combatOrderKey(right);
  return leftGroup - rightGroup || leftLevel - rightLevel || leftRole - rightRole;
}

/** Боевой порядок заклинаний. Внутри равных ключей порядок исходный: он задан книгой. */
export function orderForCombat(spells: readonly Spell[]): Spell[] {
  return [...spells].sort((left, right) => compareCombatTraits(traitsOf(left), traitsOf(right)));
}

/**
 * Куда встаёт строка, заклинанием не являющаяся: боевой список упорядочен ключом срочности, книга —
 * уровнем, и одна проверка на оба списка поставила бы её не туда.
 */
export function positionInList(
  spells: readonly Spell[],
  traits: ActionTraits,
  mode: ScreenMode,
): number {
  const standsAfter =
    mode === "combat"
      ? (spell: Spell) => compareCombatTraits(traitsOf(spell), traits) > 0
      : (spell: Spell) => traitsOf(spell).level > traits.level;
  const index = spells.findIndex(standsAfter);
  return index === -1 ? spells.length : index;
}

/** Что показывать на экране: отбор по режиму, состав по подготовке, порядок по срочности. */
export function spellsForScreen(spells: readonly Spell[], character: CharacterState): Spell[] {
  const inMode = spellsForMode(spells, character.screenMode);
  if (character.screenMode !== "combat") return inMode;
  return orderForCombat(preparedForCombat(inMode, character));
}
