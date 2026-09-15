"use client";

import { useRef } from "react";

import type { CraftingView } from "@/contract/views";

import { directionTone } from "@/ui/entities/crafting/lib/labels";
import { RULE_ROLE_WIDE, RULE_ROW, RULE_SECTION } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const LEAD =
  "Справочник мастера называет только имя эффекта и его направление. Что эффект делает и сколько " +
  "он стоит, говорит стол: перечень ничего не подставляет и ни во что не считается.";

/** Сколько эффектов у направления: длинный столбец читают, зная наперёд, докуда он идёт. */
function countRu(count: number): string {
  return `${count}`;
}

/**
 * Перечень эффектов — страница для чтения, а не список выбора. Свойство вида по-прежнему приходит
 * словами стола: мастер часто называет своё, и подстановка из перечня подменяла бы его слова.
 */
export function EffectList({ effects }: { effects: CraftingView["handbook"]["effects"] }) {
  const heads = useRef(new Map<string, HTMLElement | null>());

  return (
    <div className="flex flex-col gap-7 p-3">
      <p className="text-xs leading-relaxed text-ink-quiet">{LEAD}</p>

      {/* Перехода к направлению довольно: столбцы стоят подряд, и ни один из них не спрятан. */}
      <div className="flex items-stretch gap-1">
        {effects.map((group) => (
          <button
            key={group.dirRu}
            type="button"
            onClick={() => heads.current.get(group.dirRu)?.scrollIntoView({ block: "start" })}
            className={`min-w-0 flex-1 px-1 text-[0.6875rem] leading-tight ${SURFACE_CONTROL} ${
              TONE_TEXT[directionTone(group.dirRu)]
            }`}
          >
            {group.dirRu}
          </button>
        ))}
      </div>

      {effects.map((group) => {
        const tone = directionTone(group.dirRu);
        return (
          <section key={group.dirRu} className="flex flex-col gap-2.5">
            {/* Счёт стоит рядом с заголовком, а не внутри: читающему вслух нужно имя направления. */}
            <div
              ref={(node) => {
                heads.current.set(group.dirRu, node);
              }}
              className={`flex scroll-mt-2 items-baseline justify-between gap-3 pb-2 ${RULE_SECTION}`}
            >
              <h3 className={`text-[1.0625rem] font-semibold ${TONE_TEXT[tone]}`}>{group.dirRu}</h3>
              <span aria-hidden="true" className="shrink-0 text-[0.6875rem] tabular-nums text-ink-quiet">
                {countRu(group.namesRu.length)}
              </span>
            </div>

            <ul className="flex flex-col">
              {group.namesRu.map((nameRu) => (
                <li
                  key={nameRu}
                  className={`py-2 pl-2.5 text-[0.84375rem] leading-snug ${RULE_ROW} ${RULE_ROLE_WIDE[tone]}`}
                >
                  {nameRu}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
