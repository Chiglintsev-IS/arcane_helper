"use client";

import { useState } from "react";

import type { Command, RecipeFormulaView } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, KnownRecipeView } from "@/contract/views";

import { CHECK_DIE_RU, signed, withPlural } from "@/shared/language";
import { KindFieldEditor } from "@/ui/features/note-kind-field/ui/KindFieldEditor";
import { RevealPropertyPage } from "@/ui/features/reveal-property/ui/RevealPropertyPage";
import { AlchemyHandbook, HANDBOOK_CHAPTERS } from "@/ui/widgets/alchemy-handbook/ui/AlchemyHandbook";
import { BookSections } from "@/ui/widgets/alchemy-book/ui/BookSections";
import { KindList, kindGroups } from "@/ui/widgets/alchemy-book/ui/KindList";
import { KindPage, type KindFieldWritten } from "@/ui/widgets/alchemy-book/ui/KindPage";
import { EffectList } from "@/ui/widgets/alchemy-book/ui/EffectList";
import { RecipeList } from "@/ui/widgets/alchemy-book/ui/RecipeList";
import { RecipeBench } from "@/ui/widgets/recipe-bench/ui/RecipeBench";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { applyEdit } from "@/ui/shared/model/editing";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BackHeader } from "@/ui/shared/ui/BackHeader";
import { FooterAction } from "@/ui/shared/ui/FooterAction";
import { RULE_GROUP, RULE_TAB_OFF, RULE_TAB_ON } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PANEL } from "@/ui/shared/ui/surface";

const MODES = [
  { id: "book", titleRu: "Книга" },
  { id: "bench", titleRu: "Верстак" },
] as const;

type Mode = (typeof MODES)[number]["id"];

const SECTIONS = [
  {
    id: "kinds",
    glyph: "◆",
    titleRu: "Ингредиенты",
    leadRu: "виды, их свойства, поиск и сбор",
  },
  {
    id: "recipes",
    glyph: "℞",
    titleRu: "Рецепты",
    leadRu: "записанные формулы, повтор без броска",
  },
  {
    id: "rules",
    glyph: "§",
    titleRu: "Правила стола",
    leadRu: "раскрытие свойств · варка · оснащение",
  },
  {
    id: "effects",
    glyph: "✷",
    titleRu: "Эффекты",
    leadRu: "перечень справочника по направлениям",
  },
] as const;

type Page = "sections" | (typeof SECTIONS)[number]["id"] | "kind" | "reveal";

const NOTE_KIND = "Записать вид";
const NOTE_KIND_HINT =
  "Свойства не заполняются: вид встанет в книгу как нераскрытый и будет ждать исследования.";
const KIND_NAME_FIELD = "Название";

const NOTE_RECIPE = "Записать рецепт";
const NOTHING_TO_RECORD = "Соберите замысел на верстаке — записывать пока нечего";

const CRAFT = "Заложить партию";

const PREVIOUS = "‹";
const NEXT = "›";

const CHECK_LABEL = "Проверка против";
const CHECK_PARTS = "Зельеварение + Инт";

const SEPARATOR = " · ";

const KIND_FORMS: [string, string, string] = ["вид записан", "вида записано", "видов записано"];
const RECORD_FORMS: [string, string, string] = ["запись", "записи", "записей"];
const CHAPTER_FORMS: [string, string, string] = ["глава", "главы", "глав"];
const EFFECT_FORMS: [string, string, string] = ["название", "названия", "названий"];

const NOT_A_NUMBER = "Сложность и цена называются числом";

function emptyDraft(standard: ChoicesView["recipeForm"]["standard"]): RecipeFormulaView {
  return {
    ...standard,
    kinds: [],
    mainProperty: null,
    suppressed: [],
    limitations: [],
  };
}

function toDraft(recipe: KnownRecipeView): RecipeFormulaView {
  return { ...recipe.formula };
}

/**
 * Алхимия двумя режимами: книга — знание, верстак — работа. Экран владеет своей навигацией, своим
 * замыслом и проводкой операций; виджеты только сообщают о нажатом.
 */
export function AlchemyScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;
  const { crafting, choices } = snapshot;

  const [mode, setMode] = useState<Mode>("book");
  const [page, setPage] = useState<Page>("sections");
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [refusalRu, setRefusalRu] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeFormulaView>(() =>
    emptyDraft(choices.recipeForm.standard),
  );
  const [portions, setPortions] = useState(1);

  const send = (command: Command, whenDone?: () => void): void => {
    void applyEdit(sessionStore, command).then((reason) => {
      setRefusalRu(reason);
      if (reason === null) whenDone?.();
    });
  };

  const question: Question = { kind: "recipe_preview", formula: draft, portions };
  const answer = usePreview(question);
  const preview: PreviewOf<"recipe_preview"> | null =
    answer?.kind === "recipe_preview" ? answer : null;

  const ordered = kindGroups(crafting.ingredients).flatMap((group) => group.kinds);
  const openedAt = ordered.findIndex((kind) => kind.itemId === openedId);
  const opened = openedAt === -1 ? null : ordered[openedAt];

  const writeField = (written: KindFieldWritten, itemId: string): void => {
    const typed = written.typed.trim();
    if (typed === "") return;
    const number = requiredFieldNumber(typed);

    if (written.field === "yield") send({ kind: "note_ingredient_reference", itemId, yieldRu: typed });
    else if (written.field === "portion")
      send({ kind: "note_ingredient_reference", itemId, portionRu: typed });
    else if (Number.isNaN(number)) setRefusalRu(NOT_A_NUMBER);
    else if (written.field === "find")
      send({ kind: "note_ingredient_reference", itemId, findDc: number });
    else if (written.field === "gather")
      send({ kind: "note_ingredient_reference", itemId, gatherDc: number });
    else send({ kind: "note_ingredient_reference", itemId, priceGold: number });
  };

  const craft = (): void =>
    send({
      kind: "craft_batch",
      formula: draft,
      portions,
      ...(preview?.warnings.length === 0 ? {} : { allowAnyway: true }),
    });

  const sections = SECTIONS.map((section) => ({
    ...section,
    countRu:
      section.id === "kinds"
        ? withPlural(crafting.ingredients.length, KIND_FORMS)
        : section.id === "recipes"
          ? withPlural(crafting.recipes.length, RECORD_FORMS)
          : section.id === "effects"
            ? withPlural(
                crafting.handbook.effects.reduce((sum, one) => sum + one.namesRu.length, 0),
                EFFECT_FORMS,
              )
            : withPlural(HANDBOOK_CHAPTERS.length, CHAPTER_FORMS),
  }));

  const sectionOf = (id: Page): (typeof sections)[number] =>
    sections.find((section) => section.id === id) ?? sections[0]!;

  const header =
    page === "sections" || mode === "bench" ? null : page === "reveal" ? (
      <BackHeader
        titleRu={opened?.nameRu ?? ""}
        backNameRu={opened?.nameRu ?? ""}
        onBack={() => setPage("kind")}
      />
    ) : (
      <BackHeader
        titleRu={sectionOf(page === "kind" ? "kinds" : page).titleRu}
        backNameRu={sectionOf(page === "kind" ? "kinds" : page).titleRu}
        onBack={() => setPage(page === "kind" ? "kinds" : "sections")}
        aside={
          page !== "kind" ? (
            <span className="shrink-0 text-[0.6875rem] text-ink-soft">
              {sectionOf(page).countRu}
            </span>
          ) : (
            <span className="flex shrink-0 items-center">
              {[
                { markRu: PREVIOUS, at: openedAt - 1 },
                { markRu: NEXT, at: openedAt + 1 },
              ].map((step) => {
                const neighbour = ordered[step.at];
                return (
                  <button
                    key={step.markRu}
                    type="button"
                    disabled={neighbour === undefined}
                    title={neighbour?.nameRu}
                    aria-label={neighbour?.nameRu ?? step.markRu}
                    onClick={() => setOpenedId(neighbour?.itemId ?? null)}
                    className={`h-11 w-11 text-base text-accent disabled:text-off ${RULE_GROUP}`}
                  >
                    <span aria-hidden="true">{step.markRu}</span>
                  </button>
                );
              })}
            </span>
          )
        }
      />
    );

  const footer =
    mode === "bench" ? (
      <FooterAction
        labelRu={CRAFT}
        noteRu={
          preview?.batch == null || preview.difficulty === null
            ? null
            : `${CHECK_LABEL} ${preview.difficulty.total}${SEPARATOR}${CHECK_DIE_RU}${signed(
                preview.check?.bonus ?? 0,
              )}${SEPARATOR}${CHECK_PARTS}`
        }
        warning={preview !== null && preview.warnings.length > 0}
        disabled={preview?.batch == null}
        above={
          preview === null || preview.warnings.length === 0 ? null : (
            <p className="px-3 pt-2 text-[0.6875rem] leading-snug text-reaction">
              {preview.warnings.map((warning) => warning.reasonRu).join(SEPARATOR)}
            </p>
          )
        }
        onAct={craft}
      />
    ) : page === "kinds" ? (
      <FooterAction
        labelRu={NOTE_KIND}
        above={
          !adding ? null : (
            <div className="flex flex-col gap-2 p-3">
              <p className="text-[0.6875rem] leading-snug text-ink-quiet">{NOTE_KIND_HINT}</p>
              <KindFieldEditor
                labelRu={KIND_NAME_FIELD}
                value=""
                onWrite={(typed) => {
                  const nameRu = typed.trim();
                  if (nameRu === "") return setAdding(false);
                  send({ kind: "note_ingredient", nameRu }, () => setAdding(false));
                }}
                onCancel={() => setAdding(false)}
              />
            </div>
          )
        }
        onAct={() => setAdding(!adding)}
      />
    ) : page === "recipes" ? (
      <FooterAction
        labelRu={NOTE_RECIPE}
        noteRu={preview?.difficulty === null ? NOTHING_TO_RECORD : null}
        disabled={preview?.difficulty == null}
        onAct={() => send({ kind: "record_recipe", formula: draft })}
      />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      {/* Правила стола — одно чтение без кнопок: прокрутку такой странице клавиатуре даёт фокус. */}
      <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto">
        {mode === "bench" ? (
          <RecipeBench
            crafting={crafting}
            choices={choices.recipeForm}
            draft={draft}
            preview={preview}
            portions={portions}
            onDraft={setDraft}
            onPortions={setPortions}
            onApparatus={(apparatusRu) =>
              send({
                kind: "set_alchemy_workshop",
                ...(choices.apparatusGrades.includes(apparatusRu) ? { apparatus: apparatusRu } : {}),
              })
            }
          />
        ) : page === "sections" ? (
          <BookSections
            sections={sections}
            onOpen={(id) =>
              setPage(
                id === "kinds"
                  ? "kinds"
                  : id === "recipes"
                    ? "recipes"
                    : id === "effects"
                      ? "effects"
                      : "rules",
              )
            }
          />
        ) : page === "kinds" ? (
          <KindList
            kinds={crafting.ingredients}
            openedId={openedId}
            onOpen={(itemId) => {
              setOpenedId(itemId);
              setPage("kind");
            }}
          />
        ) : page === "reveal" && opened !== undefined && opened !== null ? (
          <RevealPropertyPage
            key={opened.itemId}
            ingredient={opened}
            directions={choices.alchemyDirections}
            rarities={choices.alchemyRarities}
            onSend={send}
          />
        ) : page === "kind" && opened !== undefined && opened !== null ? (
          <KindPage
            key={opened.itemId}
            kind={opened}
            checks={crafting.handbook.checks}
            onReveal={() => setPage("reveal")}
            onWrite={(written) => writeField(written, opened.itemId)}
          />
        ) : page === "recipes" ? (
          <RecipeList
            recipes={crafting.recipes}
            standard={choices.recipeForm.standard}
            onToBench={(recipe) => {
              setDraft(toDraft(recipe));
              setMode("bench");
            }}
          />
        ) : page === "effects" ? (
          <EffectList effects={crafting.handbook.effects} />
        ) : (
          <AlchemyHandbook
            handbook={crafting.handbook}
            apparatusRu={crafting.workshop.apparatusRu}
          />
        )}
      </div>

      {refusalRu === null ? null : (
        <p role="alert" className={`shrink-0 px-3 py-2 text-xs text-reaction ${SURFACE_PANEL}`}>
          {refusalRu}
        </p>
      )}

      {footer}

      <nav aria-label="Режим алхимии" className={`flex shrink-0 ${SURFACE_PANEL}`}>
        {MODES.map((one) => (
          <button
            key={one.id}
            type="button"
            aria-current={one.id === mode ? "page" : undefined}
            onClick={() => setMode(one.id)}
            className={`flex h-[2.875rem] flex-1 items-center justify-center text-sm font-semibold ${
              one.id === mode
                ? `${SURFACE_GROUP_BARE} text-accent ${RULE_TAB_ON}`
                : `text-ink-quiet ${RULE_TAB_OFF}`
            }`}
          >
            {one.titleRu}
          </button>
        ))}
      </nav>
    </div>
  );
}
