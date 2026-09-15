"use client";

import { useState, type ReactNode } from "react";

import type { PreviewOf, Question } from "@/contract/questions";
import type { CraftingView, IngredientKnowledgeView } from "@/contract/views";

import { coinsRu } from "@/shared/language";
import { researchNeedsRu } from "@/ui/entities/crafting/lib/labels";
import { propertySlots } from "@/ui/entities/crafting/lib/slots";
import {
  EmptyStripes,
  PropertyStripes,
  markNameRu,
} from "@/ui/entities/crafting/ui/PropertyMark";
import { CoinsEditor, PRICE_TITLE } from "@/ui/entities/character/ui/CoinsEditor";
import { KindFieldEditor } from "@/ui/features/note-kind-field/ui/KindFieldEditor";
import { editName } from "@/ui/shared/ui/buttonLabels";
import {
  BASE_DIFFICULTY_LABEL,
  INGREDIENT_RECORD_NAMES,
  RARITY_NOTE,
  propertyNumberRu,
  revealTitleRu,
} from "@/ui/shared/lib/alchemyLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { NameEditor, NAME_LABEL } from "@/ui/shared/ui/NameEditor";
import { NOT_WRITTEN, ValueRow } from "@/ui/shared/ui/ValueRow";
import { NoteList } from "@/ui/shared/ui/NoteList";
import { RemoveButton, RETURNED_IN_LOG } from "@/ui/shared/ui/RemoveButton";
import {
  RULE_EDGE_ACTIVE,
  RULE_SECTION,
  RULE_TILE,
} from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const PROPERTIES_LABEL = "СВОЙСТВА";
const SEARCH_LABEL = "ПОИСК И СБОР";

const DROP_KIND = "Убрать запись из алхимии";

const DROP_KIND_HINT =
  "Уйдёт всё записанное о виде — и раскрытое, и справка. Сама вещь с ценой и заметками останется.";

const DROP_KIND_ASK = "Убрать запись из алхимии?";

function dropKindBodyRu(nameRu: string): string {
  return `«${nameRu}» останется вещью в сумке, но всё, что алхимия о ней знает, уйдёт. ${RETURNED_IN_LOG}`;
}

const NOT_REVEALED = "не раскрыто";

const FIND_TILE = "НАЙТИ";
const GATHER_TILE = "СОБРАТЬ";
const YIELD_TILE = "СБОР ДАЁТ";

const RECORD_NAMES = INGREDIENT_RECORD_NAMES;

type Field = keyof typeof RECORD_NAMES;

export type KindFieldWritten = { readonly field: Field; readonly typed: string };


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
  currencies,
  onReveal,
  onEditProperty,
  onRename,
  onWritePrice,
  onWrite,
  onAddNote,
  onRewriteNote,
  onDropNote,
  onDropKind,
}: {
  kind: IngredientKnowledgeView;
  checks: CraftingView["handbook"]["checks"];
  currencies: readonly string[];
  onReveal: () => void;
  onEditProperty: (number: number) => void;
  onRename: (nameRu: string) => void;
  onWritePrice: (priced: Readonly<Record<string, number>>) => void;
  onWrite: (written: KindFieldWritten) => void;
  onAddNote: (textRu: string) => void;
  onRewriteNote: (noteId: string, textRu: string) => void;
  onDropNote: (noteId: string) => void;
  onDropKind: () => void;
}) {
  const [editing, setEditing] = useState<Field | "name" | "price" | null>(null);

  const written: Record<Field, string | null> = {
    find: kind.findDc === null ? null : String(kind.findDc),
    gather: kind.gatherDc === null ? null : String(kind.gatherDc),
    yield: kind.yieldRu,
    portion: kind.portionRu,
  };

  const priced: Record<string, number> = Object.fromEntries(
    currencies.map((currency) => [
      currency,
      kind.price?.find((coin) => coin.currency === currency)?.amount ?? 0,
    ]),
  );

  /* Форма встаёт там, где стоит правимое: ответ, появившийся не под пальцем, ищут глазами. */
  const editorOf = (field: Field): ReactNode =>
    editing !== field ? null : (
      <KindFieldEditor
        labelRu={RECORD_NAMES[field]}
        value={written[field] ?? ""}
        numeric={field === "find" || field === "gather"}
        onWrite={(typed) => {
          setEditing(null);
          onWrite({ field, typed });
        }}
        onCancel={() => setEditing(null)}
      />
    );

  return (
    <div className="flex flex-col gap-3.5 p-3">
      {/* Имя вида — имя самой вещи: его правят и здесь, той же формой, что в карточке. */}
      <section className={`flex flex-col gap-1.5 pb-3 ${RULE_SECTION}`}>
        <ValueRow labelRu={NAME_LABEL} valueRu={kind.nameRu} onOpen={() => setEditing("name")} />
        {editing !== "name" ? null : (
          <NameEditor
            nameRu={kind.nameRu}
            onWrite={(nameRu) => {
              setEditing(null);
              onRename(nameRu);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-[0.625rem] tracking-[0.14em] text-accent">{PROPERTIES_LABEL}</span>

        {/* Раскрытое правят нажатием по нему же: слова стола уточняются позже, чем записаны. */}
        {propertySlots(kind).map((slot) =>
          slot.nameRu === null ? (
            <div key={slot.number} className="flex items-stretch gap-2">
              <EmptyStripes height="self-stretch" />
              <span className="flex min-w-0 flex-1 items-baseline gap-2 py-1.5 pr-2">
                <span className="w-7 shrink-0 text-[0.6875rem] tabular-nums text-ink-quiet">
                  {propertyNumberRu(slot.number)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm leading-tight text-off">{NOT_REVEALED}</span>
                  <span className="text-[0.65625rem] text-ink-quiet">{markNameRu(slot)}</span>
                </span>
              </span>
            </div>
          ) : (
            <button
              key={slot.number}
              type="button"
              aria-label={editName(slot.nameRu)}
              onClick={() => onEditProperty(slot.number)}
              className={`flex min-h-11 items-stretch gap-2 text-left ${SURFACE_GROUP_BARE}`}
            >
              <PropertyStripes slot={slot} height="self-stretch" />
              <span className="flex min-w-0 flex-1 items-baseline gap-2 py-1.5 pr-2">
                <span className="w-7 shrink-0 text-[0.6875rem] tabular-nums text-ink-quiet">
                  {propertyNumberRu(slot.number)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm leading-tight">{slot.nameRu}</span>
                  <span className="text-[0.65625rem] text-ink-quiet">{markNameRu(slot)}</span>
                </span>
              </span>
            </button>
          ),
        )}
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

        {editorOf("find")}
        {editorOf("gather")}

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

        {editorOf("yield")}
      </section>

      <section className="flex flex-col gap-1.5">
        <ValueRow
          labelRu={RECORD_NAMES.portion}
          valueRu={written.portion}
          onOpen={() => setEditing("portion")}
        />
        {editorOf("portion")}

        <ValueRow
          labelRu={PRICE_TITLE}
          valueRu={kind.price === null ? null : coinsRu(kind.price)}
          onOpen={() => setEditing("price")}
        />
        {editing !== "price" ? null : (
          <CoinsEditor
            titleRu={PRICE_TITLE}
            currencies={currencies}
            coins={priced}
            onWrite={(price) => {
              setEditing(null);
              onWritePrice(price);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </section>

      {/* Заметки вида — заметки самой вещи: их правят одной и той же формой, где бы их ни читали. */}
      <NoteList
        notes={kind.notes}
        onAdd={onAddNote}
        onRewrite={onRewriteNote}
        onDrop={onDropNote}
      />

      <section className="flex flex-col gap-1">
        <RemoveButton
          labelRu={DROP_KIND}
          nameRu={kind.nameRu}
          askRu={DROP_KIND_ASK}
          bodyRu={dropKindBodyRu(kind.nameRu)}
          onConfirm={onDropKind}
        />
        <p className="text-[0.65rem] leading-snug text-ink-quiet">{DROP_KIND_HINT}</p>
      </section>
    </div>
  );
}
