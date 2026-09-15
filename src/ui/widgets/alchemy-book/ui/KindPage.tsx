"use client";

import { useState } from "react";

import type { PreviewOf, Question } from "@/contract/questions";
import type { CraftingView, IngredientKnowledgeView } from "@/contract/views";

import { coinRu } from "@/shared/language";
import { directionTone, researchNeedsRu } from "@/ui/entities/crafting/lib/labels";
import { KindFieldEditor } from "@/ui/features/note-kind-field/ui/KindFieldEditor";
import {
  BASE_DIFFICULTY_LABEL,
  RARITY_NOTE,
  propertyNumberRu,
  revealTitleRu,
} from "@/ui/shared/lib/alchemyLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import {
  RULE_BLOCK,
  RULE_EDGE_ACTIVE,
  RULE_ROLE_WIDE,
  RULE_ROW,
  RULE_SECTION,
  RULE_TILE,
} from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const PROPERTIES_LABEL = "СВОЙСТВА";
const SEARCH_LABEL = "ПОИСК И СБОР";
const NOTES_LABEL = "СО СЛОВ МАСТЕРА";

const NOT_REVEALED = "не раскрыто";
const NOT_WRITTEN = "не записано";

const FIND_TILE = "НАЙТИ";
const GATHER_TILE = "СОБРАТЬ";
const YIELD_TILE = "СБОР ДАЁТ";

const RECORD_NAMES = {
  find: "СЛ поиска",
  gather: "СЛ сбора",
  yield: "Выход с источника",
  portion: "Что такое порция",
  price: "Цена порции",
} as const;

type Field = keyof typeof RECORD_NAMES;

export type KindFieldWritten = { readonly field: Field; readonly typed: string };

type Slot = { readonly number: number; readonly nameRu: string | null; readonly dirRu: string | null };

/** Четыре слота подряд: раскрытое стоит на своём номере, нераскрытое держит своё место пустым. */
function slotsOf(kind: IngredientKnowledgeView): readonly Slot[] {
  return [
    ...kind.properties.map((property) => ({
      number: property.number,
      nameRu: property.nameRu,
      dirRu: property.dirRu,
    })),
    ...kind.researchNumbers.map((number) => ({ number, nameRu: null, dirRu: null })),
  ].sort((one, other) => one.number - other.number);
}

function Tile({
  labelRu,
  captionRu,
  valueRu,
  tone,
  onOpen,
}: {
  labelRu: string;
  captionRu: string;
  valueRu: string | null;
  tone: "accent" | "action" | "ritual";
  onOpen: () => void;
}) {
  const written = valueRu !== null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 p-2 text-left ${SURFACE_GROUP_BARE} ${
        RULE_TILE[tone === "accent" ? "muted" : tone]
      }`}
    >
      <span className="text-[0.625rem] tracking-[0.1em] text-ink-quiet">{labelRu}</span>
      <span
        className={`text-[1.375rem] font-semibold leading-none tabular-nums ${
          written ? (tone === "accent" ? "text-accent" : TONE_TEXT[tone]) : "text-off"
        }`}
      >
        {valueRu ?? NOT_WRITTEN}
      </span>
      <span className="text-[0.625rem] leading-tight text-ink-quiet">{captionRu}</span>
    </button>
  );
}

function Record({
  labelRu,
  valueRu,
  onOpen,
}: {
  labelRu: string;
  valueRu: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-11 w-full items-baseline justify-between gap-3 py-2 text-left ${RULE_ROW}`}
    >
      <span className="shrink-0 text-xs text-ink-quiet">{labelRu}</span>
      <span className={`min-w-0 text-right text-[0.8125rem] ${valueRu === null ? "text-off" : ""}`}>
        {valueRu ?? NOT_WRITTEN}
      </span>
    </button>
  );
}

function Research({ kind, onReveal }: { kind: IngredientKnowledgeView; onReveal: () => void }) {
  const number = kind.researchNumbers[0] ?? null;
  const question: Question | null =
    number === null ? null : { kind: "research_preview", itemId: kind.itemId, number };
  const answer = usePreview(question);
  const research: PreviewOf<"research_preview"> | null =
    answer?.kind === "research_preview" ? answer : null;

  if (number === null || research?.plan == null) return null;
  const plan = research.plan;

  return (
    <button
      type="button"
      onClick={onReveal}
      className={`flex w-full flex-col gap-2 p-3.5 text-left ${SURFACE_GROUP_BARE} ${RULE_EDGE_ACTIVE}`}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="text-[1.0625rem] font-semibold leading-tight text-accent">
          {revealTitleRu(number)}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">
            {BASE_DIFFICULTY_LABEL}
          </span>
          <span className="text-4xl font-semibold leading-none tabular-nums">
            {plan.difficulty}
          </span>
          <span className="text-[0.625rem] text-ink-quiet">{RARITY_NOTE}</span>
        </span>
      </span>

      <dl className="flex w-full flex-col gap-0.5">
        {researchNeedsRu(plan).map((need) => (
          <div key={need.labelRu} className="flex items-baseline gap-2">
            <dt className="w-[5.5rem] shrink-0 text-[0.6875rem] text-ink-quiet">{need.labelRu}</dt>
            <dd className="min-w-0 flex-1 text-[0.8125rem] leading-snug">{need.valueRu}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

/**
 * Страница вида: всё, что отряд о нём знает, и место, куда дописывают названное мастером. Запаса,
 * кнопок «в состав» и записи сбора здесь нет — этим занят верстак и общий счёт вещей.
 */
export function KindPage({
  kind,
  checks,
  onReveal,
  onWrite,
}: {
  kind: IngredientKnowledgeView;
  checks: CraftingView["handbook"]["checks"];
  onReveal: () => void;
  onWrite: (written: KindFieldWritten) => void;
}) {
  const [editing, setEditing] = useState<Field | null>(null);

  const written: Record<Field, string | null> = {
    find: kind.findDc === null ? null : String(kind.findDc),
    gather: kind.gatherDc === null ? null : String(kind.gatherDc),
    yield: kind.yieldRu,
    portion: kind.portionRu,
    price: kind.price === null ? null : coinRu(kind.price.amount, kind.price.currency),
  };

  const editor =
    editing === null ? null : (
      <KindFieldEditor
        labelRu={RECORD_NAMES[editing]}
        value={editing === "price" && kind.price !== null ? String(kind.price.amount) : (written[editing] ?? "")}
        numeric={editing === "find" || editing === "gather" || editing === "price"}
        onWrite={(typed) => {
          setEditing(null);
          onWrite({ field: editing, typed });
        }}
        onCancel={() => setEditing(null)}
      />
    );

  return (
    <div className="flex flex-col gap-3.5 p-3">
      <h2 className={`pb-2 text-[1.3125rem] font-semibold leading-tight ${RULE_SECTION}`}>
        {kind.nameRu}
      </h2>

      <section className="flex flex-col gap-1">
        <span className="text-[0.625rem] tracking-[0.14em] text-accent">{PROPERTIES_LABEL}</span>

        {slotsOf(kind).map((slot) => (
          <div
            key={slot.number}
            className={`flex items-baseline gap-2 py-1.5 pl-2 ${
              RULE_ROLE_WIDE[directionTone(slot.dirRu)]
            } ${slot.nameRu === null ? "" : SURFACE_GROUP_BARE}`}
          >
            <span className="w-7 shrink-0 text-[0.6875rem] tabular-nums text-ink-quiet">
              {propertyNumberRu(slot.number)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`text-sm leading-tight ${slot.nameRu === null ? "text-off" : ""}`}>
                {slot.nameRu ?? NOT_REVEALED}
              </span>
              {slot.dirRu === null ? null : (
                <span className="text-[0.65625rem] text-ink-quiet">{slot.dirRu}</span>
              )}
            </span>
          </div>
        ))}
      </section>

      <Research kind={kind} onReveal={onReveal} />

      <section className="flex flex-col gap-1">
        <span className="text-[0.625rem] tracking-[0.14em] text-accent">{SEARCH_LABEL}</span>

        <div className="flex items-stretch gap-1">
          <Tile
            labelRu={FIND_TILE}
            captionRu={checks.findRu}
            valueRu={written.find}
            tone="accent"
            onOpen={() => setEditing("find")}
          />
          <Tile
            labelRu={GATHER_TILE}
            captionRu={checks.gatherRu}
            valueRu={written.gather}
            tone="action"
            onOpen={() => setEditing("gather")}
          />
        </div>

        <button
          type="button"
          onClick={() => setEditing("yield")}
          className={`flex min-h-11 w-full flex-col items-start gap-0.5 p-2 text-left ${SURFACE_GROUP_BARE} ${RULE_TILE.ritual}`}
        >
          <span className="text-[0.625rem] tracking-[0.1em] text-ink-quiet">{YIELD_TILE}</span>
          <span
            className={`text-xs font-semibold leading-snug ${
              written.yield === null ? "text-off" : TONE_TEXT.ritual
            }`}
          >
            {written.yield ?? NOT_WRITTEN}
          </span>
        </button>
      </section>

      <section className="flex flex-col">
        <Record
          labelRu={RECORD_NAMES.portion}
          valueRu={written.portion}
          onOpen={() => setEditing("portion")}
        />
        <Record
          labelRu={RECORD_NAMES.price}
          valueRu={written.price}
          onOpen={() => setEditing("price")}
        />
      </section>

      {editor}

      {kind.notes.length === 0 ? null : (
        <section className="flex flex-col gap-1">
          <span className="text-[0.625rem] tracking-[0.14em] text-accent">{NOTES_LABEL}</span>
          {kind.notes.map((note) => (
            <p key={note.id} className={`py-0.5 pl-2 text-xs leading-snug text-ink-soft ${RULE_BLOCK}`}>
              {note.textRu}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
