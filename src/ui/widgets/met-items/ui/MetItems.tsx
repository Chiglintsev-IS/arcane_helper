"use client";

import { useState } from "react";

import type { ItemView } from "@/contract/views";
import { RULE_BETWEEN, RULE_COLUMN, RULE_EDGE_ACTIVE, RULE_EDGE_BOTTOM, RULE_EDGE_QUIET, RULE_GROUP } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN } from "@/ui/shared/ui/surface";

const PARTS = ["all", "athand", "wanted"] as const;

type Part = (typeof PARTS)[number];

const PART_TITLES: Record<Part, string> = {
  all: "Всё",
  athand: "При себе",
  wanted: "Купить",
};

const AT_HAND = "при себе";

const AWAY = "нет при себе";

const TO_BUY = "в покупки";

const IN_BUY = "в покупках";

const EMPTY: Record<Part, string> = {
  all: "Ни одной вещи ещё не заведено.",
  athand: "Из встреченного при себе ничего не осталось.",
  wanted: "Ничего не отмечено к покупке.",
};

const BETWEEN = " · ";

function atHand(item: ItemView): boolean {
  return item.ownedCount > 0;
}

function suits(item: ItemView, part: Part): boolean {
  if (part === "athand") return atHand(item);
  if (part === "wanted") return item.wanted;
  return true;
}

/**
 * Встречалось: всё, о чём стол говорил, — и то, что при себе, и то, что только видели. Где видели и
 * за сколько, хранят заметки самой вещи: слова о ней приходят по одной и живут при ней.
 */
export function MetItems({
  items,
  openedId,
  onOpenItem,
  onToggleWanted,
}: {
  items: readonly ItemView[];
  openedId: string | null;
  onOpenItem: (id: string) => void;
  onToggleWanted: (id: string) => void;
}) {
  const [part, setPart] = useState<Part>("all");

  const shown = items.filter((item) => suits(item, part));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="radiogroup"
        aria-label="Какие вещи"
        className={`flex shrink-0 gap-1.5 px-3 py-2 ${RULE_EDGE_BOTTOM}`}
      >
        {PARTS.map((one) => (
          <button
            key={one}
            type="button"
            role="radio"
            aria-checked={one === part}
            onClick={() => setPart(one)}
            className={`min-h-11 flex-1 px-2 text-xs ${
              one === part ? `${SURFACE_CHOSEN} font-medium` : `text-ink-quiet ${RULE_GROUP}`
            }`}
          >
            {PART_TITLES[one]}{" "}
            <span className="tabular-nums text-ink-quiet">
              {items.filter((item) => suits(item, one)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-quiet">{EMPTY[part]}</p>
        ) : (
          <ul aria-label={PART_TITLES[part]} className={`flex flex-col ${RULE_BETWEEN}`}>
            {shown.map((item) => {
              const whereRu = item.notes.map((note) => note.textRu).join(BETWEEN);
              return (
                <li
                  key={item.id}
                  className={`flex items-stretch ${
                    item.id === openedId ? RULE_EDGE_ACTIVE : RULE_EDGE_QUIET
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenItem(item.id)}
                    className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2 text-left"
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`min-w-0 flex-1 text-sm leading-tight ${
                          atHand(item) ? "" : "text-ink-soft"
                        }`}
                      >
                        {item.nameRu}
                      </span>
                      <span
                        className={`shrink-0 text-[0.625rem] ${
                          atHand(item) ? "text-accent" : "text-ink-quiet"
                        }`}
                      >
                        {atHand(item) ? AT_HAND : AWAY}
                      </span>
                    </span>
                    {whereRu === "" ? null : (
                      <span className="text-[0.65rem] leading-snug text-ink-quiet">{whereRu}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    aria-pressed={item.wanted}
                    aria-label={`${item.wanted ? IN_BUY : TO_BUY}: ${item.nameRu}`}
                    onClick={() => onToggleWanted(item.id)}
                    className={`w-16 shrink-0 px-1 text-[0.6rem] leading-tight ${
                      item.wanted ? "text-accent" : "text-ink-quiet"
                    } ${RULE_COLUMN}`}
                  >
                    {item.wanted ? IN_BUY : TO_BUY}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
