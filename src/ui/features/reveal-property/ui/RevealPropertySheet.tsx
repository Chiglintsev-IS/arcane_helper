"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { IngredientKnowledgeView } from "@/contract/views";

import { researchCostRu, stockRu } from "@/ui/entities/crafting/lib/labels";
import {
  NOTHING_REVEALED,
  PROPERTIES_EXHAUSTED,
  propertyNumberRu,
} from "@/ui/shared/lib/alchemyLabels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { RULE_BETWEEN } from "@/ui/shared/ui/rule";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ingredientPropertiesName(nameRu: string): string {
  return `Свойства: ${nameRu}`;
}

const PROPERTIES_TITLE = "Раскрытые свойства";

const REVEAL_TITLE = "Раскрыть следующее";

/** Свойство приходит словами стола: перечня, из которого его выбирать, у приложения нет. */
const PROPERTY_FIELD = "Свойство";

const PROPERTY_HINT =
  "Свойство — то, что вещество делает в составе: совпав с таким же у другого вида, оно входит в смесь.";

const PORTION_FIELD = "Штук в порции";

const PORTION_HINT = "Столько штук из сумки уходит на одну рецептурную порцию.";

/**
 * Мера вида правится отдельной командой, не дожидаясь «Сохранить»: свойство и порция — разные
 * записи об одной вещи, и одна не отменяет другую.
 */
function PortionSize({
  ingredient,
  onSet,
}: {
  ingredient: IngredientKnowledgeView;
  onSet: (pieces: number) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  const commit = (): void => {
    if (typed === null) return;
    const pieces = requiredFieldNumber(typed);
    setTyped(null);
    if (!Number.isNaN(pieces) && pieces !== ingredient.piecesPerPortion) onSet(pieces);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-quiet">{PORTION_FIELD}</span>
        <input
          type="number"
          inputMode="numeric"
          aria-label={PORTION_FIELD}
          value={typed ?? String(ingredient.piecesPerPortion)}
          onChange={(event) => setTyped(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className={`min-h-11 w-20 px-2 text-center ${FIELD_TEXT} tabular-nums ${SURFACE_CONTROL}`}
        />
      </div>
      <p className="text-xs leading-snug text-ink-quiet">
        {PORTION_HINT} Сейчас {stockRu(ingredient)}.
      </p>
    </div>
  );
}

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

const OBSERVATIONS_HINT =
  "Слова стола, которых свойством не записать: в совпадения, сложность и партию они не входят.";

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

      <p className="text-xs leading-snug text-ink-quiet">{OBSERVATIONS_HINT}</p>

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
  refusalRu,
  onSend,
  onCancel,
}: {
  ingredient: IngredientKnowledgeView;
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
  const onPortionSize = (pieces: number): void =>
    onSend({ kind: "set_portion_size", itemId, pieces });
  const onNoteObservation = (textRu: string): void =>
    onSend({ kind: "note_observation", itemId, textRu });
  const onRewriteObservation = (observationId: string, textRu: string): void =>
    onSend({ kind: "rewrite_observation", itemId, observationId, textRu });
  const onDropObservation = (observationId: string): void =>
    onSend({ kind: "drop_observation", itemId, observationId });
  const [propertyRu, setPropertyRu] = useState("");
  const [chosenNumber, setChosenNumber] = useState<number | null>(null);
  const number = chosenNumber ?? ingredient.researchNumbers[0] ?? null;

  const question: Question | null =
    number === null ? null : { kind: "research_preview", itemId, number };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={ingredientPropertiesName(nameRu)}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto p-3 ${SURFACE_PANEL}`}
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

      <PortionSize ingredient={ingredient} onSet={onPortionSize} />

      {number === null ? null : (
        <>
          <span className="text-xs text-ink-quiet">{REVEAL_TITLE}</span>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-ink-quiet">Номер</span>
            <select
              value={String(number)}
              onChange={(event) => setChosenNumber(Number(event.target.value))}
              className={`min-h-11 w-full px-2 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
            >
              {ingredient.researchNumbers.map((option) => (
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
            <p className="text-xs leading-snug text-ink-quiet">{PROPERTY_HINT}</p>
            <GrowingField
              labelRu={PROPERTY_FIELD}
              value={propertyRu}
              onChange={setPropertyRu}
              onSubmit={setPropertyRu}
            />
          </div>
        </>
      )}

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
        {PROPERTIES_EXHAUSTED}
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
        {number === null ? null : (
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
        )}
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 flex-1 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
