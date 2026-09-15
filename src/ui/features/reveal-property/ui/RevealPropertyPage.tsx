"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { IngredientKnowledgeView } from "@/contract/views";

import { rarityTone, researchNeedsRu } from "@/ui/entities/crafting/lib/labels";
import { PropertyStripes, markNameRu } from "@/ui/entities/crafting/ui/PropertyMark";
import {
  BASE_DIFFICULTY_LABEL,
  NOTHING_REVEALED,
  RARITY_NOTE,
  propertyNumberRu,
  revealTitleRu,
} from "@/ui/shared/lib/alchemyLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { RULE_EDGE_ACTIVE, RULE_ROW, RULE_TITLE } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const COST_LABEL = "Чего это стоит";
const DIRECTION_LABEL = "НАПРАВЛЕНИЕ";
const NAMED_LABEL = "ЧТО МАСТЕР НАЗВАЛ";
const REVEALED_LABEL = "УЖЕ РАСКРЫТО";
const RARITY_LABEL = "РЕДКОСТЬ";

const RARITY_HINT = "Редкость называет мастер: от неё зависит и цена эффекта, и сложность работы.";

/** Свойство приходит словами стола: перечня, из которого его выбирать, у приложения нет. */
const PROPERTY_FIELD = "Свойство";
const PROPERTY_HINT = "Свойство словами мастера";

const WRITE_DOWN = "Записать";

function Label({ children }: { children: string }) {
  return <span className="text-[0.625rem] tracking-[0.14em] text-accent">{children}</span>;
}

/**
 * Цена очередного раскрытия — строка справочника: время, порции, расходники и то, чем такую работу
 * ведут. Нашего набора здесь нет: книга о нём не знает, и требование названо правилом.
 */
function Cost({ plan }: { plan: NonNullable<PreviewOf<"research_preview">["plan"]> }) {
  return (
    <div className={`flex flex-col ${SURFACE_GROUP_BARE} ${RULE_EDGE_ACTIVE}`}>
      <div className="flex items-start justify-between gap-3 p-3">
        <span className="text-[0.8125rem] text-ink-quiet">{COST_LABEL}</span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">
            {BASE_DIFFICULTY_LABEL}
          </span>
          <span className="text-4xl font-semibold leading-none tabular-nums">{plan.difficulty}</span>
          <span className="text-[0.625rem] text-ink-quiet">{RARITY_NOTE}</span>
        </span>
      </div>

      <dl className="flex flex-col">
        {researchNeedsRu(plan).map((need) => (
          <div key={need.labelRu} className={`flex items-baseline gap-3 px-3 py-2 ${RULE_ROW}`}>
            <dt className="w-[6.25rem] shrink-0 text-[0.8125rem] text-ink-quiet">{need.labelRu}</dt>
            <dd className="min-w-0 flex-1 text-[0.9375rem] leading-snug">{need.valueRu}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Раскрытие свойства — отдельная страница книги, а не шторка поверх вида: работа стоит времени,
 * порций и расходников, и прочесть эту цену надо целиком, не теряя из виду страницу вида.
 */
export function RevealPropertyPage({
  ingredient,
  directions,
  rarities,
  onSend,
}: {
  ingredient: IngredientKnowledgeView;
  directions: readonly string[];
  rarities: readonly string[];
  onSend: (command: Command, whenDone?: () => void) => void;
}) {
  const [propertyRu, setPropertyRu] = useState("");
  const [dirRu, setDirRu] = useState<string | null>(null);
  const [rarityRu, setRarityRu] = useState<string | null>(null);
  const itemId = ingredient.itemId;
  const number = ingredient.researchNumbers[0] ?? null;

  const question: Question | null =
    number === null ? null : { kind: "research_preview", itemId, number };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  const reveal = (textRu: string): void => {
    if (number === null || textRu.trim() === "") return;
    onSend(
      {
        kind: "reveal_property",
        itemId,
        number,
        propertyRu: textRu.trim(),
        ...(dirRu === null ? {} : { directionRu: dirRu }),
        ...(rarityRu === null ? {} : { rarityRu }),
      },
      () => {
        setPropertyRu("");
        setDirRu(null);
        setRarityRu(null);
      },
    );
  };

  return (
    <div className="flex flex-col gap-3.5 p-3">
      {number === null ? null : (
        <h2 className={`pb-2 text-[1.625rem] font-semibold leading-tight ${RULE_TITLE}`}>
          {revealTitleRu(number)}
        </h2>
      )}

      {research?.plan == null ? null : <Cost plan={research.plan} />}

      {research?.refusalRu === undefined ? null : (
        <p className="text-xs leading-snug text-ink-soft">{research.refusalRu}</p>
      )}

      {number === null ? null : (
        <>
          <section className="flex flex-col gap-1.5">
            <Label>{DIRECTION_LABEL}</Label>
            <div className="flex flex-wrap items-stretch gap-2">
              {directions.map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={direction === dirRu}
                  onClick={() => setDirRu(direction === dirRu ? null : direction)}
                  className={`min-h-[3.5rem] grow basis-[45%] px-1 text-[0.8125rem] leading-tight ${
                    direction === dirRu ? SURFACE_CHOSEN : SURFACE_CONTROL
                  }`}
                >
                  {direction}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <Label>{RARITY_LABEL}</Label>
            <div className="flex flex-wrap items-stretch gap-1">
              {rarities.map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  aria-pressed={rarity === rarityRu}
                  onClick={() => setRarityRu(rarity === rarityRu ? null : rarity)}
                  className={`min-h-11 grow px-2 text-[0.6875rem] leading-tight ${
                    rarity === rarityRu ? SURFACE_CHOSEN : SURFACE_CONTROL
                  } ${TONE_TEXT[rarityTone(rarity)]}`}
                >
                  {rarity}
                </button>
              ))}
            </div>
            <p className="text-[0.65625rem] leading-snug text-ink-quiet">{RARITY_HINT}</p>
          </section>

          <section className="flex flex-col gap-1.5">
            <Label>{NAMED_LABEL}</Label>
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <GrowingField
                  labelRu={PROPERTY_FIELD}
                  placeholderRu={PROPERTY_HINT}
                  value={propertyRu}
                  onChange={setPropertyRu}
                  onSubmit={reveal}
                />
              </div>
              <button
                type="button"
                onClick={() => reveal(propertyRu)}
                className={`shrink-0 px-4 text-[0.9375rem] font-semibold ${SURFACE_PRIMARY}`}
              >
                {WRITE_DOWN}
              </button>
            </div>
          </section>
        </>
      )}

      <section className="flex flex-col gap-1.5">
        <Label>{REVEALED_LABEL}</Label>

        {ingredient.properties.length === 0 ? (
          <p className="text-xs text-ink-quiet">{NOTHING_REVEALED}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ingredient.properties.map((property) => (
              <li
                key={property.number}
                className={`flex items-stretch gap-3 ${SURFACE_GROUP_BARE}`}
              >
                <PropertyStripes slot={property} height="self-stretch" />
                <span className="w-7 shrink-0 self-center py-2.5 text-[0.6875rem] tabular-nums text-ink-quiet">
                  {propertyNumberRu(property.number)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center py-2.5">
                  <span className="text-[0.9375rem] leading-tight">{property.nameRu}</span>
                  <span className="text-[0.6875rem] text-ink-quiet">{markNameRu(property)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${BUTTON_LABELS.remove}: ${property.nameRu}`}
                  onClick={() => onSend({ kind: "drop_property", itemId, number: property.number })}
                  className="shrink-0 self-center px-2 text-[0.8125rem] lowercase text-reaction"
                >
                  {BUTTON_LABELS.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
