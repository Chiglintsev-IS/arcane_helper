"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { IngredientKnowledgeView } from "@/contract/views";

import { researchNeedsRu } from "@/ui/entities/crafting/lib/labels";
import { NOTHING_REVEALED, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { NoteList } from "@/ui/shared/ui/NoteList";
import { RULE_BETWEEN, RULE_BLOCK } from "@/ui/shared/ui/rule";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ingredientPropertiesName(nameRu: string): string {
  return `Свойства: ${nameRu}`;
}

const PROPERTIES_TITLE = "Раскрытые свойства";

/** Свойство приходит словами стола: перечня, из которого его выбирать, у приложения нет. */
const PROPERTY_FIELD = "Свойство";

/** Направление называет стол вместе со свойством — либо не называет вовсе. */
const DIRECTION_FIELD = "Направление";

const DIFFICULTY_LABEL = "Сложность";

const NEEDS_TITLE = "Требования";

/** Номера идут подряд: очередное свойство ремесло называет само, выбирать игроку не из чего. */
function revealTitleRu(number: number): string {
  return `Раскрыть ${propertyNumberRu(number)} свойство`;
}

function ResearchNeeds({ plan }: { plan: NonNullable<PreviewOf<"research_preview">["plan"]> }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-quiet">{NEEDS_TITLE}</span>

      <dl className="flex flex-col gap-0.5 text-xs">
        {researchNeedsRu(plan).map((need) => (
          <div key={need.labelRu} className="flex items-baseline gap-2">
            <dt className="w-20 shrink-0 text-ink-quiet">{need.labelRu}</dt>
            <dd className="min-w-0 flex-1 leading-snug">{need.valueRu}</dd>
          </div>
        ))}
      </dl>

      {/* Слова о наборе приходят целой фразой от ремесла: метка к ним не нужна, она в них самих. */}
      {plan.requirementRu === null ? null : (
        <p className={`py-0.5 pl-2 text-xs leading-snug text-ink-soft ${RULE_BLOCK}`}>
          {plan.requirementRu}
        </p>
      )}

      {plan.rawSampleRu === null ? null : (
        <p className="text-xs leading-snug text-ink-quiet">{plan.rawSampleRu}</p>
      )}
    </div>
  );
}

/**
 * Шторка ведёт запись вещи целиком, и обе двери к ней — «Алхимия» и «Вещи» — приносят только свой
 * способ отправить команду и закрыться.
 */
export function RevealPropertySheet({
  ingredient,
  directions,
  refusalRu,
  onSend,
  onCancel,
}: {
  ingredient: IngredientKnowledgeView;
  directions: readonly string[];
  refusalRu: string | null;
  onSend: (command: Command, whenDone?: () => void) => void;
  onCancel: () => void;
}) {
  const nameRu = ingredient.nameRu;
  const itemId = ingredient.itemId;
  const onDropProperty = (number: number): void =>
    onSend({ kind: "drop_property", itemId, number });
  const onAddNote = (textRu: string): void => onSend({ kind: "add_item_note", itemId, textRu });
  const onEditNote = (noteId: string, textRu: string): void =>
    onSend({ kind: "edit_item_note", itemId, noteId, textRu });
  const onRemoveNote = (noteId: string): void =>
    onSend({ kind: "remove_item_note", itemId, noteId });
  const [propertyRu, setPropertyRu] = useState("");
  const [dirRu, setDirRu] = useState<string | null>(null);
  const number = ingredient.researchNumbers[0] ?? null;

  const reveal = (textRu: string): void => {
    if (number === null) return;
    onSend(
      {
        kind: "reveal_property",
        itemId,
        number,
        propertyRu: textRu,
        ...(dirRu === null ? {} : { directionRu: dirRu }),
      },
      () => {
        setPropertyRu("");
        setDirRu(null);
      },
    );
  };

  const question: Question | null =
    number === null ? null : { kind: "research_preview", itemId, number };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  return (
    <Sheet
      titleRu={ingredientPropertiesName(nameRu)}
      footer={
        <>
          {refusalRu === null ? null : (
            <p className="text-xs text-ink-soft">{refusalRu}</p>
          )}

          <button
            type="button"
            onClick={onCancel}
            className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            Закрыть
          </button>
        </>
      }
    >
      {number === null ? null : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold leading-tight">{revealTitleRu(number)}</span>
            {research?.plan == null ? null : (
              <span className="shrink-0 text-xs text-ink-quiet">
                {DIFFICULTY_LABEL}{" "}
                <span className="text-2xl font-semibold tabular-nums leading-none text-ink">
                  {research.plan.difficulty}
                </span>
              </span>
            )}
          </div>

          {research?.plan == null ? null : <ResearchNeeds plan={research.plan} />}

          {research?.refusalRu === undefined ? null : (
            <p className="text-xs text-ink-soft">{research.refusalRu}</p>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-quiet">{DIRECTION_FIELD}</span>
            <div className="flex flex-wrap gap-1">
              {directions.map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={direction === dirRu}
                  onClick={() => setDirRu(direction === dirRu ? null : direction)}
                  className={`min-h-11 grow px-2 text-xs ${
                    direction === dirRu ? SURFACE_CHOSEN : SURFACE_CONTROL
                  }`}
                >
                  {direction}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-stretch gap-1">
            <div className="min-w-0 flex-1">
              <GrowingField
                labelRu={PROPERTY_FIELD}
                value={propertyRu}
                onChange={setPropertyRu}
                onSubmit={reveal}
              />
            </div>
            <button
              type="button"
              onClick={() => reveal(propertyRu)}
              className={`min-h-11 shrink-0 px-3 text-sm font-semibold ${SURFACE_PRIMARY}`}
            >
              {BUTTON_LABELS.save}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-quiet">{PROPERTIES_TITLE}</span>

        {ingredient.properties.length === 0 ? (
          <p className="text-xs text-ink-quiet">{NOTHING_REVEALED}</p>
        ) : (
          <ul aria-label={PROPERTIES_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
            {ingredient.properties.map((property) => (
              <li key={property.number} className="flex items-center gap-2 py-1.5">
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-quiet">
                  {propertyNumberRu(property.number)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm leading-tight">{property.nameRu}</span>
                  {property.dirRu === null ? null : (
                    <span className="text-xs text-ink-quiet">{property.dirRu}</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`${BUTTON_LABELS.remove}: ${property.nameRu}`}
                  onClick={() => onDropProperty(property.number)}
                  className={`min-h-11 shrink-0 px-3 text-xs font-medium text-reaction ${SURFACE_CONTROL}`}
                >
                  {BUTTON_LABELS.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NoteList
        notes={ingredient.notes}
        onAdd={onAddNote}
        onRewrite={onEditNote}
        onDrop={onRemoveNote}
      />

    </Sheet>
  );
}
