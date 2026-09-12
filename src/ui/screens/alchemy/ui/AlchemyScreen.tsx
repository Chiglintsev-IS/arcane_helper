"use client";

import { useId, useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView } from "@/contract/views";

import { CHECK_DIE_RU, MISHAP_DIE_RU } from "@/shared/language";
import { IngredientCard, mixtureChoiceName } from "@/ui/entities/crafting/ui/IngredientCard";
import { WorkshopSheet } from "@/ui/features/edit-workshop/ui/WorkshopSheet";
import { RevealPropertySheet } from "@/ui/features/reveal-property/ui/RevealPropertySheet";
import { AlchemyHandbook } from "@/ui/widgets/alchemy-handbook/ui/AlchemyHandbook";
import { RecipeBench, type RecipeDraft } from "@/ui/widgets/recipe-bench/ui/RecipeBench";
import { applyEdit } from "@/ui/shared/model/editing";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { usePreview } from "@/ui/shared/model/usePreview";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const WORKSHOP_TITLE = "Мастерская";

const NO_KIT = "Набора нет, работа импровизацией";

const TABS = [
  { id: "kinds", labelRu: "Ингредиенты" },
  { id: "bench", labelRu: "Верстак" },
  { id: "handbook", labelRu: "Справочник" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const NOTHING_CHOSEN =
  "Виды состава отмечают знаком «+» в списке ингредиентов: верстак назовёт цену того, что собрано.";

const TO_KINDS = "К ингредиентам";

const CHOSEN_TITLE = "В составе";

function emptyDraft(standard: ChoicesView["recipeForm"]["standard"]): RecipeDraft {
  return { ...standard, kinds: [], mainProperty: null, suppressed: [], limitations: [] };
}

export function AlchemyScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;
  const { crafting, choices } = snapshot;

  const [tab, setTab] = useState<Tab>("kinds");
  const [draft, setDraft] = useState<RecipeDraft>(() => emptyDraft(choices.recipeForm.standard));
  const [portionsText, setPortionsText] = useState("1");
  const [rolledText, setRolledText] = useState("");
  const [mishapText, setMishapText] = useState("");
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [refusalRu, setRefusalRu] = useState<string | null>(null);
  const panelId = useId();

  const portions = requiredFieldNumber(portionsText);
  const rolled = requiredFieldNumber(rolledText);
  const mishapRolled = requiredFieldNumber(mishapText);

  const question: Question | null =
    draft.kinds.length === 0
      ? null
      : {
          kind: "recipe_preview",
          formula: { ...draft },
          portions,
          ...(Number.isNaN(rolled) ? {} : { rolled }),
        };
  const answer = usePreview(question);
  const preview: PreviewOf<"recipe_preview"> | null =
    answer?.kind === "recipe_preview" ? answer : null;

  const choose = (itemId: string): void =>
    setDraft({
      ...draft,
      kinds: draft.kinds.includes(itemId)
        ? draft.kinds.filter((kind) => kind !== itemId)
        : [...draft.kinds, itemId],
    });

  const craft = (): void => {
    void sessionStore.getState().execute({
      kind: "craft_batch",
      formula: { ...draft },
      portions,
      ...(Number.isNaN(rolled) ? {} : { rolled }),
      ...(Number.isNaN(mishapRolled) ? {} : { mishapRolled }),
    });
  };

  const send = (command: Command, close: () => void): void => {
    void applyEdit(sessionStore, command).then((reason) => {
      setRefusalRu(reason);
      if (reason === null) close();
    });
  };

  const openedIngredient = crafting.ingredients.find((one) => one.itemId === opened);
  const chosen = crafting.ingredients.filter((one) => draft.kinds.includes(one.itemId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setRefusalRu(null);
            setWorkshopOpen(true);
          }}
          className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left ${SURFACE_GROUP}`}
        >
          <span className="shrink-0 text-xs text-ink-quiet">{WORKSHOP_TITLE}</span>
          <span className="min-w-0 text-sm leading-tight">
            {crafting.workshop.apparatusRu ?? NO_KIT}
          </span>
        </button>
      </div>

      <div role="tablist" className="flex shrink-0 gap-1 px-3 pt-2">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === tab}
            aria-controls={panelId}
            onClick={() => setTab(candidate.id)}
            className={`h-11 flex-1 text-sm ${
              candidate.id === tab ? `font-semibold ${SURFACE_CHOSEN}` : SURFACE_CONTROL
            }`}
          >
            {candidate.labelRu}
          </button>
        ))}
      </div>

      {/* Справочник — одно чтение без кнопок: прокрутку такой вкладки клавиатуре даёт только фокус. */}
      <div
        id={panelId}
        role="tabpanel"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2"
      >
        {tab === "kinds" ? (
          <div className="flex flex-col gap-2">
            <QuickAddField
              labelRu="Записать вид"
              onAdd={(nameRu) => send({ kind: "note_ingredient", nameRu }, () => undefined)}
            />

            {crafting.ingredients.length === 0 ? (
              <p className="text-sm text-ink-quiet">
                Об ингредиентах пока ничего не записано. Здесь встанут виды и раскрытые у них
                свойства; сколько порций лежит в сумке, отвечают «Вещи».
              </p>
            ) : (
              <ul aria-label="Знание об ингредиентах" className="flex flex-col gap-2">
                {crafting.ingredients.map((ingredient) => (
                  <IngredientCard
                    key={ingredient.itemId}
                    ingredient={ingredient}
                    chosen={draft.kinds.includes(ingredient.itemId)}
                    onChoose={() => choose(ingredient.itemId)}
                    onOpen={() => {
                      setRefusalRu(null);
                      setOpened(ingredient.itemId);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : tab === "bench" ? (
          <div className="flex flex-col gap-2">
            {chosen.length === 0 ? (
              <div className={`flex flex-col items-start gap-2 p-3 ${SURFACE_GROUP}`}>
                <p className="text-sm leading-snug text-ink-quiet">{NOTHING_CHOSEN}</p>
                <button
                  type="button"
                  onClick={() => setTab("kinds")}
                  className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
                >
                  {TO_KINDS}
                </button>
              </div>
            ) : (
              <div className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP}`}>
                <span className="text-xs text-ink-quiet">{CHOSEN_TITLE}</span>
                <ul aria-label={CHOSEN_TITLE} className="flex flex-wrap gap-1">
                  {chosen.map((ingredient) => (
                    <li key={ingredient.itemId}>
                      <button
                        type="button"
                        onClick={() => choose(ingredient.itemId)}
                        aria-label={mixtureChoiceName(true, ingredient.nameRu)}
                        className={`min-h-11 px-3 text-sm ${SURFACE_CHOSEN}`}
                      >
                        {ingredient.nameRu} <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {chosen.length === 0 ? null : (
              <RecipeBench
                choices={choices.recipeForm}
                preview={preview}
                draft={draft}
                portions={portionsText}
                rolledText={rolledText}
                mishapText={mishapText}
                rollLabels={{ check: CHECK_DIE_RU, mishap: MISHAP_DIE_RU }}
                onDraft={setDraft}
                onPortions={setPortionsText}
                onRolled={setRolledText}
                onMishap={setMishapText}
                onCraft={craft}
              />
            )}
          </div>
        ) : (
          <AlchemyHandbook
            handbook={crafting.handbook}
            apparatusRu={crafting.workshop.apparatusRu}
          />
        )}
      </div>

      {workshopOpen ? (
        <WorkshopSheet
          workshop={crafting.workshop}
          choices={choices}
          refusalRu={refusalRu}
          onConfirm={(command) => send(command, () => setWorkshopOpen(false))}
          onCancel={() => {
            setRefusalRu(null);
            setWorkshopOpen(false);
          }}
        />
      ) : null}

      {openedIngredient === undefined ? null : (
        <RevealPropertySheet
          key={openedIngredient.itemId}
          ingredient={openedIngredient}
          refusalRu={refusalRu}
          onSend={(command, whenDone) => send(command, whenDone ?? (() => undefined))}
          onCancel={() => {
            setRefusalRu(null);
            setOpened(null);
          }}
        />
      )}
    </div>
  );
}
