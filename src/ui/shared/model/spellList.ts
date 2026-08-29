/**
 * Состав и порядок списка заклинаний на экране.
 *
 * Отбор живёт здесь, а не в компоненте, по той же причине, что и фильтры: список в бою и список в
 * мастере применения обязаны считаться одной функцией, иначе они разойдутся и приложению перестанут
 * верить.
 *
 * Правил здесь нет ни одного: применимость, цена и роль приезжают строкой проекции, а этот модуль
 * решает, что показать и в каком порядке.
 */

import type { SpellRowView } from "@/contract/views";

import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";
import type { ScreenMode } from "@/ui/shared/model/screenMode";

/**
 * Порядок ролей внутри одной цены: сначала всё прочее, потом чем бить, потом чем закрыться.
 *
 * Небоевое наверху, потому что его труднее всего найти: боевое и защиту ищут по цвету линейки и
 * знаку роли, а «другое» — только глазами по списку, и стоять ему лучше там, где список начинается.
 *
 * Списком, а не словарём: место роли — её номер в нём, и роль, которой в списке нет, встаёт перед
 * всеми, не заводя ветки на случай, которого правила не знают.
 */
const ROLE_ORDER = ["other", "offense", "defense"];

/**
 * Место строки в списке: сначала цена, потом роль.
 *
 * Реакции наверх не поднимаются: их ищут переключателем и кнопкой «Реакции», которая стоит вне
 * списка и видна независимо от фильтров, — а третий ключ стоил списку понятности, потому что в
 * половине случаев ключ ничего не упорядочивал.
 */
export function orderKey(traits: ActionTraits): [number, number] {
  return [traits.level, ROLE_ORDER.indexOf(traits.role)];
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
export function orderForPlay(spells: readonly SpellRowView[]): SpellRowView[] {
  return [...spells].sort((left, right) => compareTraits(traitsOf(left), traitsOf(right)));
}

/**
 * Куда встаёт строка, заклинанием не являющаяся: «Игра» упорядочена ценой, книга — уровнем, и одна
 * проверка на оба списка поставила бы её не туда.
 */
export function positionInList(
  spells: readonly SpellRowView[],
  traits: ActionTraits,
  mode: ScreenMode,
): number {
  const standsAfter =
    mode === "play"
      ? (spell: SpellRowView) => compareTraits(traitsOf(spell), traits) > 0
      : (spell: SpellRowView) => spell.level > traits.level;
  const index = spells.findIndex(standsAfter);
  return index === -1 ? spells.length : index;
}

/**
 * Что показывать на экране.
 *
 * «Книга» показывает весь состав в исходном порядке: там смотрят состав, а не то, чем сходить.
 * «Игра» отбирает применимое в этой обстановке и упорядочивает ценой. Там, где списка нет вовсе,
 * он пуст.
 */
export function spellsForScreen(spells: readonly SpellRowView[], mode: ScreenMode): SpellRowView[] {
  switch (mode) {
    case "book":
      return [...spells];
    case "play":
      return orderForPlay(spells.filter((spell) => spell.castableNow));
    default:
      return [];
  }
}
