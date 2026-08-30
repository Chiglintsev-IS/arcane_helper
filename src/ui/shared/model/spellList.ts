import type { SpellRowView } from "@/contract/views";

import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";
import type { ScreenMode } from "@/ui/shared/model/screenMode";

const ROLE_ORDER = ["other", "offense", "defense"];

export function orderKey(traits: ActionTraits): [number, number] {
  return [traits.level, ROLE_ORDER.indexOf(traits.role)];
}

export function compareTraits(left: ActionTraits, right: ActionTraits): number {
  const [leftPrice, leftRole] = orderKey(left);
  const [rightPrice, rightRole] = orderKey(right);
  return leftPrice - rightPrice || leftRole - rightRole;
}

export function orderForPlay(spells: readonly SpellRowView[]): SpellRowView[] {
  return [...spells].sort((left, right) => compareTraits(traitsOf(left), traitsOf(right)));
}

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
