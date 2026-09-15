"use client";

import {
  ITEM_TRAITS,
  itemTraitLabel,
  type ItemTrait,
} from "@/ui/entities/character/lib/itemTraits";
import { RULE_GROUP, RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

import { stanceOf, type TraitSift } from "../model/itemFilter";

export const SIFT_TITLE = "Признаки";

const EXCEPT_MARK = "✕";

const CHIP = "min-h-11 rounded-full px-3 text-xs";

/** Сито по признакам: нажатие ведёт чип по кругу «только это» → «кроме этого» → снято. */
export function ItemSift({
  sift,
  onCycle,
}: {
  sift: TraitSift;
  onCycle: (trait: ItemTrait) => void;
}) {
  return (
    <div
      aria-label={SIFT_TITLE}
      className={`flex flex-wrap gap-1.5 px-3 py-2 ${SURFACE_GROUP_BARE}`}
    >
      {ITEM_TRAITS.map((trait) => {
        const stance = stanceOf(sift, trait);
        const labelRu = itemTraitLabel(trait);
        return (
          <button
            key={trait}
            type="button"
            aria-pressed={stance !== undefined}
            aria-label={stance === "not" ? `Кроме: ${labelRu}` : labelRu}
            onClick={() => onCycle(trait)}
            className={
              stance === "only"
                ? `${CHIP} font-medium ${SURFACE_PRIMARY}`
                : stance === "not"
                  ? `${CHIP} ${TONE_TEXT.reaction} ${RULE_MARK.reaction}`
                  : `${CHIP} text-ink-quiet ${RULE_GROUP}`
            }
          >
            {stance === "not" ? <span aria-hidden="true">{EXCEPT_MARK} </span> : null}
            {labelRu}
          </button>
        );
      })}
    </div>
  );
}
