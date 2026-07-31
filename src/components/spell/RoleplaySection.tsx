/**
 * Блок отыгрыша (F-04) с маркером обязательного.
 *
 * Оформление у блока заведомо другое — пунктир, курсив, свой цвет: художественный текст нельзя
 * перепутать с механикой (AC-20, ADR-0005). Единственная механическая строка здесь — что из отыгрыша
 * обязательно по правилам ([ADR-0011](../../../docs/decisions.md#adr-0011)): вербальный компонент
 * значит, что заклинание нужно произнести вслух, и забывают об этом чаще всего.
 */

"use client";

import { useState } from "react";

import type { Spell } from "@/data/schemas/spell";
import type { RoleplayCategory } from "@/store/castDraftStore";

const CATEGORY_LABELS: Record<RoleplayCategory, string> = {
  short: "Коротко",
  atmospheric: "Атмосферно",
  sarcastic: "Саркастично",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as RoleplayCategory[];

/** Что из отыгрыша требуют правила, а что остаётся украшением. */
function requirementNote(components: Spell["components"]): string {
  if (components.verbal && components.somatic) {
    return "Обязательно: произнести вслух и сделать жест свободной рукой";
  }
  if (components.verbal) return "Обязательно: произнести вслух";
  if (components.somatic) return "Обязательно: жест свободной рукой";
  return "Ни голоса, ни жеста правила не требуют — отыгрыш по желанию";
}

function Variants({
  spell,
  category,
  onCategory,
}: {
  spell: Spell;
  category: RoleplayCategory;
  onCategory: (category: RoleplayCategory) => void;
}) {
  const variants = spell.roleplay.completeVariants[category];

  return (
    <div className="flex flex-col gap-2">
      {/* Механическая строка внутри художественного блока — единственная и помечена как требование. */}
      <p className="rounded-md border border-concentration/40 bg-concentration/10 px-2 py-1 text-xs font-medium not-italic text-concentration">
        {requirementNote(spell.components)}
      </p>

      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => onCategory(value)}
            className={`min-h-11 rounded-lg border px-2 text-xs ${
              category === value
                ? "border-concentration text-concentration"
                : "border-slate-200 text-slate-500 dark:border-slate-800"
            }`}
          >
            {CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      {variants.length === 0 ? (
        <p className="text-sm">Отыгрыш этой категории не заполнен</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm italic">
          {variants.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1 text-xs italic text-slate-600 dark:text-slate-400">
        <div>
          <dt className="not-italic">Реплика</dt>
          <dd>{spell.roleplay.incantations.join(" · ")}</dd>
        </div>
        <div>
          <dt className="not-italic">Жест</dt>
          <dd>{spell.roleplay.gestures.join(" · ")}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Блок отыгрыша. В карточке он свёрнут (`collapsible`), в мастере применения — раскрыт: там выбор
 * категории часть применения, а не справка.
 */
export function RoleplaySection({
  spell,
  collapsible = false,
  category: controlled,
  onCategory,
}: {
  spell: Spell;
  collapsible?: boolean;
  category?: RoleplayCategory;
  onCategory?: (category: RoleplayCategory) => void;
}) {
  const [local, setLocal] = useState<RoleplayCategory>("short");
  const category = controlled ?? local;
  const change = (value: RoleplayCategory): void => {
    setLocal(value);
    onCategory?.(value);
  };

  if (collapsible) {
    return (
      <details className="rounded-lg border border-dashed border-concentration/50 bg-concentration/5 p-2">
        <summary className="cursor-pointer text-sm font-medium text-concentration">Отыгрыш</summary>
        <div className="mt-2">
          <Variants spell={spell} category={category} onCategory={change} />
        </div>
      </details>
    );
  }

  return (
    <section
      aria-label="Отыгрыш"
      className="flex flex-col gap-2 rounded-lg border border-dashed border-concentration/50 bg-concentration/5 p-2"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-concentration">Отыгрыш</h3>
      <Variants spell={spell} category={category} onCategory={change} />
    </section>
  );
}
