"use client";

import { useEffect, useRef, useState } from "react";

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
import { scrollPlaces } from "@/ui/shared/model/scrollPlaces";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BackHeader } from "@/ui/shared/ui/BackHeader";
import { FooterAction } from "@/ui/shared/ui/FooterAction";
import { NAME_LABEL } from "@/ui/shared/ui/NameEditor";
import { RULE_GROUP, RULE_TAB_OFF, RULE_TAB_ON } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE, SURFACE_PANEL } from "@/ui/shared/ui/surface";

const MODES = [
  { id: "book", titleRu: "Книга" },
  { id: "bench", titleRu: "Верстак" },
] as const;

type Mode = (typeof MODES)[number]["id"];

const BENCH_TITLE = MODES[1].titleRu;

/**
 * Откуда пришли на страницу вида — оттуда же с неё и уходят: из списка, с верстака или с чужого
 * экрана. Возврат не туда, откуда пришёл, стоит игроку лишнего пути обратно.
 */
type Whence = "kinds" | "bench" | "away";

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

const KINDS_TITLE = SECTIONS[0].titleRu;

type Page = "sections" | (typeof SECTIONS)[number]["id"] | "kind" | "reveal";

const NOTE_KIND = "Записать вид";
const NOTE_KIND_HINT =
  "Свойства не заполняются: вид встанет в книгу как нераскрытый и будет ждать исследования.";

const NOTE_RECIPE = "Записать рецепт";
const NOTHING_TO_RECORD = "Соберите замысел на верстаке — записывать пока нечего";

/*
 * Верстак считает и называет, а не делает: бросок за столом, и его исход мастер вправе повернуть
 * как угодно. Списывать порции наперёд значило бы решить за стол и заставить потом всё чинить.
 */
const ROLL_LABEL = "БРОСОК";

const PREVIOUS = "‹";
const NEXT = "›";

/* Книга, уже раскрытая, нажатием по своей закладке поднимает к оглавлению: иначе со страницы вида
 * в правила или к рецептам хода нет вовсе — только назад по тому пути, каким пришли. */
const TO_SECTIONS = "Книга: к разделам";

const PREVIOUS_KIND = "Предыдущий вид";
const NEXT_KIND = "Следующий вид";

const CHECK_LABEL = "Проверка против";
const CHECK_PARTS = "Зельеварение + Инт";

const SEPARATOR = " · ";

const KIND_FORMS: [string, string, string] = ["вид записан", "вида записано", "видов записано"];
const RECORD_FORMS: [string, string, string] = ["запись", "записи", "записей"];
const CHAPTER_FORMS: [string, string, string] = ["глава", "главы", "глав"];
const EFFECT_FORMS: [string, string, string] = ["название", "названия", "названий"];

const NOT_A_NUMBER = "Сложность вида называется числом";

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
export function AlchemyScreen({
  initialKindId,
  whenceNameRu,
  onLeave,
}: {
  initialKindId?: string;
  /** Как зовётся экран, с которого сюда пришли за видом: его называет возврат. */
  whenceNameRu?: string;
  onLeave?: () => void;
} = {}) {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;
  const { crafting, choices } = snapshot;

  const [mode, setMode] = useState<Mode>("book");
  const [page, setPage] = useState<Page>(initialKindId === undefined ? "sections" : "kind");
  const [openedId, setOpenedId] = useState<string | null>(initialKindId ?? null);
  const [whence, setWhence] = useState<Whence>(initialKindId === undefined ? "kinds" : "away");
  const [adding, setAdding] = useState(false);
  /* Номер раскрытого, которое правят: страница та же, что у записи, и поля на ней те же. */
  const [edited, setEdited] = useState<number | null>(null);
  const [refusalRu, setRefusalRu] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeFormulaView>(() =>
    emptyDraft(choices.recipeForm.standard),
  );
  const [portions, setPortions] = useState(1);

  const viewport = useRef<HTMLDivElement>(null);
  const [places] = useState(scrollPlaces);
  /* Место узнаётся страницей, а не отметкой открытого: список видов один и тот же, кого ни открой. */
  const place = mode === "bench" ? mode : page === "kind" ? `${page}:${openedId ?? ""}` : page;

  /*
   * Прокрутка у книги одна на все страницы, а место у каждой своё: открытая начинается сверху, а
   * та, куда вернулись, — там, где её оставили. Иначе нажатие внизу выносит на середину чужой
   * страницы, и искать начало приходится глазами.
   */
  useEffect(() => {
    viewport.current!.scrollTop = places.at(place);
  }, [place, places]);

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

  const openKind = (itemId: string, from: Whence): void => {
    setOpenedId(itemId);
    setWhence(from);
    setMode("book");
    setPage("kind");
  };

  /* Со страницы вида уходят туда, откуда пришли; книга при этом остаётся раскрытой на списке. */
  const leaveKind = (): void => {
    setWhence("kinds");
    setPage("kinds");
    if (whence === "bench") setMode("bench");
    if (whence === "away") onLeave?.();
  };

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
    else send({ kind: "note_ingredient_reference", itemId, gatherDc: number });
  };

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

  const whenceTitleRu =
    whence === "bench"
      ? BENCH_TITLE
      : whence === "away"
        ? (whenceNameRu ?? KINDS_TITLE)
        : KINDS_TITLE;

  const header =
    page === "sections" || mode === "bench" ? null : page === "reveal" ? (
      <BackHeader
        titleRu={opened?.nameRu ?? ""}
        backNameRu={opened?.nameRu ?? ""}
        onBack={() => setPage("kind")}
      />
    ) : page === "kind" ? (
      <BackHeader
        titleRu={whenceTitleRu}
        backNameRu={whenceTitleRu}
        onBack={leaveKind}
        aside={
          <span className="flex shrink-0 items-center">
            {[
              { markRu: PREVIOUS, nameRu: PREVIOUS_KIND, at: openedAt - 1 },
              { markRu: NEXT, nameRu: NEXT_KIND, at: openedAt + 1 },
            ].map((step) => {
              const neighbour = ordered[step.at];
              return (
                <button
                  key={step.markRu}
                  type="button"
                  disabled={neighbour === undefined}
                  title={neighbour?.nameRu}
                  aria-label={
                    neighbour === undefined ? step.nameRu : `${step.nameRu}: ${neighbour.nameRu}`
                  }
                  onClick={() => {
                    /* Пролистнув к соседу, игрок листает книгу: карточка, с которой пришли, уже
                     * не о нём, и возврат ведёт к списку видов, а не к чужой вещи. */
                    if (whence === "away") setWhence("kinds");
                    setOpenedId(neighbour?.itemId ?? null);
                  }}
                  className={`h-11 w-11 text-base text-accent disabled:text-off ${RULE_GROUP}`}
                >
                  <span aria-hidden="true">{step.markRu}</span>
                </button>
              );
            })}
          </span>
        }
      />
    ) : (
      <BackHeader
        titleRu={sectionOf(page).titleRu}
        backNameRu={sectionOf(page).titleRu}
        onBack={() => setPage("sections")}
        aside={
          <span className="shrink-0 text-[0.6875rem] text-ink-soft">{sectionOf(page).countRu}</span>
        }
      />
    );

  const checkRu =
    preview?.batch == null || preview.difficulty === null
      ? null
      : `${CHECK_LABEL} ${preview.difficulty.total}${SEPARATOR}${CHECK_DIE_RU}${signed(
          preview.check?.bonus ?? 0,
        )}${SEPARATOR}${CHECK_PARTS}`;

  const warningsRu =
    preview === null || preview.warnings.length === 0
      ? null
      : preview.warnings.map((warning) => warning.reasonRu).join(SEPARATOR);

  /*
   * Замысел, который ремесло не приняло, называет причину: гаснущее число её не заменяет. Пустой
   * верстак причины не имеет — там ещё ничего не собрано, и красная строка кричала бы впустую.
   */
  const deniedRu = draft.kinds.length === 0 ? null : (preview?.refusalRu ?? null);

  const footer =
    mode === "bench" ? (
      checkRu === null && warningsRu === null && deniedRu === null ? null : (
        <div className={`flex shrink-0 flex-col gap-1 px-3 py-2 ${SURFACE_PANEL}`}>
          {deniedRu === null ? null : (
            <p role="alert" className="text-xs leading-snug text-reaction">
              {deniedRu}
            </p>
          )}
          {warningsRu === null ? null : (
            <p className="text-[0.6875rem] leading-snug text-reaction">{warningsRu}</p>
          )}
          {checkRu === null ? null : (
            <p className="flex flex-col gap-0.5">
              <span className="text-[0.625rem] tracking-[0.14em] text-accent">{ROLL_LABEL}</span>
              <span className="text-[0.8125rem] font-semibold leading-snug">{checkRu}</span>
            </p>
          )}
        </div>
      )
    ) : page === "kinds" ? (
      <FooterAction
        labelRu={NOTE_KIND}
        above={
          !adding ? null : (
            <div className="flex flex-col gap-2 p-3">
              <p className="text-[0.6875rem] leading-snug text-ink-quiet">{NOTE_KIND_HINT}</p>
              <KindFieldEditor
                labelRu={NAME_LABEL}
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
      <div
        ref={viewport}
        tabIndex={0}
        onScroll={(event) => places.leftAt(place, event.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {mode === "bench" ? (
          <RecipeBench
            crafting={crafting}
            choices={choices.recipeForm}
            draft={draft}
            preview={preview}
            portions={portions}
            onDraft={setDraft}
            onPortions={setPortions}
            onOpenKind={(itemId) => openKind(itemId, "bench")}
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
            onOpen={(itemId) => openKind(itemId, "kinds")}
          />
        ) : page === "reveal" && opened !== undefined && opened !== null ? (
          <RevealPropertyPage
            key={`${opened.itemId}:${edited ?? ""}`}
            ingredient={opened}
            edited={opened.properties.find((property) => property.number === edited)}
            directions={choices.alchemyDirections}
            rarities={choices.alchemyRarities}
            onSend={send}
          />
        ) : page === "kind" && opened !== undefined && opened !== null ? (
          <KindPage
            key={opened.itemId}
            kind={opened}
            checks={crafting.handbook.checks}
            currencies={choices.currencies}
            onReveal={() => {
              setEdited(null);
              setPage("reveal");
            }}
            onEditProperty={(number) => {
              setEdited(number);
              setPage("reveal");
            }}
            onRename={(nameRu) => send({ kind: "rename_item", itemId: opened.itemId, nameRu })}
            onWritePrice={(priced) =>
              send({ kind: "note_ingredient_reference", itemId: opened.itemId, price: priced })
            }
            onWrite={(written) => writeField(written, opened.itemId)}
            onAddNote={(textRu) => send({ kind: "add_item_note", itemId: opened.itemId, textRu })}
            onRewriteNote={(noteId, textRu) =>
              send({ kind: "edit_item_note", itemId: opened.itemId, noteId, textRu })
            }
            onDropNote={(noteId) =>
              send({ kind: "remove_item_note", itemId: opened.itemId, noteId })
            }
            onDropKind={() =>
              send({ kind: "drop_ingredient", itemId: opened.itemId }, () => {
                setOpenedId(null);
                setWhence("kinds");
                setPage("kinds");
              })
            }
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
        {MODES.map((one) => {
          const toSections = one.id === mode && one.id === "book" && page !== "sections";
          return (
            <button
              key={one.id}
              type="button"
              aria-current={one.id === mode ? "page" : undefined}
              aria-label={toSections ? TO_SECTIONS : undefined}
              onClick={() => {
                if (!toSections) return setMode(one.id);
                setWhence("kinds");
                setPage("sections");
              }}
              className={`flex h-[2.875rem] flex-1 items-center justify-center text-sm font-semibold ${
                one.id === mode
                  ? `${SURFACE_GROUP_BARE} text-accent ${RULE_TAB_ON}`
                  : `text-ink-quiet ${RULE_TAB_OFF}`
              }`}
            >
              {one.titleRu}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
