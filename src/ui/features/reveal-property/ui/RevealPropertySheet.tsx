"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import { researchCostRu } from "@/ui/entities/crafting/lib/labels";
import { NOTHING_REVEALED, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { RULE_BETWEEN } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ingredientPropertiesName(nameRu: string): string {
  return `Свойства: ${nameRu}`;
}

const PROPERTIES_TITLE = "Раскрытые свойства";

const REVEAL_TITLE = "Раскрыть следующее";

/** Свойство приходит словами стола: перечня, из которого его выбирать, у приложения нет. */
const PROPERTY_FIELD = "Свойство";

function ResearchCost({ plan }: { plan: NonNullable<PreviewOf<"research_preview">["plan"]> }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink-quiet">Сложность</span>
        <span className="text-2xl font-semibold tabular-nums leading-none">{plan.difficulty}</span>
      </div>
      <p className="text-xs text-ink-quiet">{researchCostRu(plan)}</p>
      {plan.rawSampleRu === null ? null : (
        <p className="text-xs text-ink-quiet">{plan.rawSampleRu}</p>
      )}
    </div>
  );
}

const OBSERVATIONS_TITLE = "Наблюдения";

const OBSERVATION_FIELD = "Наблюдение";

const OBSERVATIONS_EMPTY = "Ничего не записано словами";

/**
 * Сказанное столом о виде: короткими записями, каждая правится и убирается отдельно. Одним сплошным
 * текстом это не держат — заметки приходят по одной и живут поодиночке.
 */
function Observations({
  observations,
  onNote,
  onRewrite,
  onDrop,
}: {
  observations: IngredientKnowledgeView["observations"];
  onNote: (textRu: string) => void;
  onRewrite: (observationId: string, textRu: string) => void;
  onDrop: (observationId: string) => void;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const open = (id: string, textRu: string): void => {
    setOpened(id);
    setDraft(textRu);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-quiet">{OBSERVATIONS_TITLE}</span>

      {observations.length === 0 ? (
        <p className="text-xs text-ink-quiet">{OBSERVATIONS_EMPTY}</p>
      ) : (
        <ul aria-label={OBSERVATIONS_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {observations.map((seen) =>
            seen.id === opened ? (
              <li key={seen.id} className="flex flex-col gap-1 py-1.5">
                <GrowingField
                  labelRu={OBSERVATION_FIELD}
                  value={draft}
                  autoFocus
                  onChange={setDraft}
                  onSubmit={(text) => {
                    setOpened(null);
                    onRewrite(seen.id, text);
                  }}
                  onCancel={() => setOpened(null)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpened(null);
                    onDrop(seen.id);
                  }}
                  className={`min-h-11 px-3 text-xs font-medium text-reaction ${SURFACE_CONTROL}`}
                >
                  {BUTTON_LABELS.remove}
                </button>
              </li>
            ) : (
              <li key={seen.id} className="py-1.5">
                <button
                  type="button"
                  aria-label={editName(seen.textRu)}
                  onClick={() => open(seen.id, seen.textRu)}
                  className="w-full text-left text-sm leading-snug"
                >
                  {seen.textRu}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <QuickAddField labelRu={OBSERVATION_FIELD} onAdd={onNote} />
    </div>
  );
}

/**
 * Шторка ведёт запись вещи целиком, и обе двери к ней — «Алхимия» и «Вещи» — приносят только свой
 * способ отправить команду и закрыться.
 */
export function RevealPropertySheet({
  ingredient,
  choices,
  refusalRu,
  onSend,
  onCancel,
}: {
  ingredient: IngredientKnowledgeView;
  choices: ChoicesView;
  refusalRu: string | null;
  onSend: (command: Command, whenDone?: () => void) => void;
  onCancel: () => void;
}) {
  const nameRu = ingredient.nameRu;
  const itemId = ingredient.itemId;
  const onExhausted = (exhausted: boolean): void =>
    onSend({ kind: "mark_properties_exhausted", itemId, exhausted });
  const onDropProperty = (number: number): void =>
    onSend({ kind: "drop_property", itemId, number });
  const onNoteObservation = (textRu: string): void =>
    onSend({ kind: "note_observation", itemId, textRu });
  const onRewriteObservation = (observationId: string, textRu: string): void =>
    onSend({ kind: "rewrite_observation", itemId, observationId, textRu });
  const onDropObservation = (observationId: string): void =>
    onSend({ kind: "drop_observation", itemId, observationId });
  const [propertyRu, setPropertyRu] = useState("");
  const [number, setNumber] = useState(choices.propertyNumbers[0] ?? 1);

  const question: Question = { kind: "research_preview", itemId, number };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={ingredientPropertiesName(nameRu)}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <h2 className="text-base font-semibold leading-tight">
        {ingredientPropertiesName(nameRu)}
      </h2>

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
                <span className="min-w-0 flex-1 text-sm leading-tight">{property.nameRu}</span>
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

      <span className="text-xs text-ink-quiet">{REVEAL_TITLE}</span>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-ink-quiet">Номер</span>
        <select
          value={String(number)}
          onChange={(event) => setNumber(Number(event.target.value))}
          className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
        >
          {choices.propertyNumbers.map((option) => (
            <option key={option} value={String(option)}>
              {propertyNumberRu(option)}
            </option>
          ))}
        </select>
      </label>

      {research?.plan == null ? null : <ResearchCost plan={research.plan} />}

      {research?.refusalRu === undefined ? null : (
        <p className="text-xs text-ink-soft">{research.refusalRu}</p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-quiet">{PROPERTY_FIELD}</span>
        <GrowingField
          labelRu={PROPERTY_FIELD}
          value={propertyRu}
          onChange={setPropertyRu}
          onSubmit={setPropertyRu}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={ingredient.propertiesExhausted}
        onClick={() => onExhausted(!ingredient.propertiesExhausted)}
        className={`min-h-11 px-3 text-sm ${
          ingredient.propertiesExhausted
          ? `${SURFACE_CHOSEN} font-medium`
          : `text-ink-quiet ${SURFACE_CONTROL}`
        }`}
      >
        Свойств у вида больше нет
      </button>

      <Observations
        observations={ingredient.observations}
        onNote={onNoteObservation}
        onRewrite={onRewriteObservation}
        onDrop={onDropObservation}
      />

      {refusalRu === null ? null : (
        <p className="text-xs text-ink-soft">{refusalRu}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSend(
              {
                kind: "reveal_property",
                itemId,
                number,
                propertyRu,
              },
              onCancel,
            )
          }
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
