"use client";

import { RULE_SECTION, RULE_SIGN } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

export type BookSection = {
  readonly id: string;
  readonly glyph: string;
  readonly titleRu: string;
  readonly leadRu: string;
  readonly countRu: string;
};

const TITLE = "Книга алхимика";

const SECTIONS_LABEL = "РАЗДЕЛЫ";

const FORWARD = "→";

/**
 * Оглавление книги: верхний уровень — разделы, а не список видов. Сколько бы видов ни накопилось,
 * до правил и рецептов остаётся одно нажатие.
 */
export function BookSections({
  sections,
  onOpen,
}: {
  sections: readonly BookSection[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className={`shrink-0 px-3 pb-3 pt-3.5 text-xl font-semibold ${RULE_SECTION}`}>{TITLE}</h2>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <span className="text-[0.625rem] tracking-[0.14em] text-accent">{SECTIONS_LABEL}</span>

        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onOpen(section.id)}
            className={`flex min-h-[5.25rem] items-center gap-3.5 p-3.5 text-left ${SURFACE_GROUP}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center text-base text-accent ${RULE_SIGN}`}
            >
              {section.glyph}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[1.0625rem] font-semibold leading-tight">
                {section.titleRu}
              </span>
              <span className="text-[0.65625rem] leading-tight text-ink-quiet">
                {section.leadRu}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-[0.65625rem] text-ink-soft">{section.countRu}</span>
              <span aria-hidden="true" className="text-sm text-ink-quiet">
                {FORWARD}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
