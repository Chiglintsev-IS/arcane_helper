"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import { CHECK_DIE_RU, MISHAP_DIE_RU } from "@/shared/language";
import { propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { WorkshopSheet } from "@/ui/features/edit-workshop/ui/WorkshopSheet";
import {
  RevealPropertySheet,
  ingredientPropertiesName,
} from "@/ui/features/reveal-property/ui/RevealPropertySheet";
import { RecipeBench, type RecipeDraft } from "@/ui/widgets/recipe-bench/ui/RecipeBench";
import { applyEdit } from "@/ui/shared/model/editing";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { usePreview } from "@/ui/shared/model/usePreview";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const WORKSHOP_TITLE = "Мастерская";

const PROPERTIES_BUTTON = "Свойства";

const NO_KIT = "Набора нет, работа импровизацией";

function emptyDraft(standard: ChoicesView["recipeForm"]["standard"]): RecipeDraft {
  return { ...standard, kinds: [], mainProperty: null, suppressed: [], limitations: [] };
}

function revealedCountRu(ingredient: IngredientKnowledgeView): string {
  const count = ingredient.properties.length;
  return ingredient.propertiesExhausted
    ? `раскрыто ${count} из ${count}`
    : `раскрыто ${count} · следующее не исследовано`;
}

function chosenMarkRu(chosen: boolean, ingredient: IngredientKnowledgeView): string {
  const revealed = revealedCountRu(ingredient);
  const stock = `в сумке ${ingredient.inBag}`;
  return chosen ? `в составе · ${stock} · ${revealed}` : `${stock} · ${revealed}`;
}

function KnownIngredient({
  ingredient,
  chosen,
  onChoose,
  onOpen,
}: {
  ingredient: IngredientKnowledgeView;
  chosen: boolean;
  onChoose: () => void;
  onOpen: () => void;
}) {
  return (
    <li className={`flex flex-col ${chosen ? SURFACE_CONTROL : SURFACE_GROUP}`}>
      <button
        type="button"
        aria-pressed={chosen}
        onClick={onChoose}
        className="flex w-full flex-col gap-2 p-3 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold leading-tight">{ingredient.nameRu}</span>
          <span className="text-xs text-ink-quiet">
            {chosenMarkRu(chosen, ingredient)}
          </span>
        </span>

        {ingredient.properties.length === 0 ? null : (
          <span className="flex flex-col gap-1">
            {ingredient.properties.map((property) => (
              <span key={property.number} className="flex items-start gap-2">
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-quiet">
                  {propertyNumberRu(property.number)}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-tight">{property.nameRu}</span>
              </span>
            ))}
          </span>
        )}

        {ingredient.observations.length === 0 ? null : (
          <span className="flex flex-col gap-0.5">
            {ingredient.observations.map((seen) => (
              <span key={seen.id} className="text-xs leading-snug text-ink-soft">
                {seen.textRu}
              </span>
            ))}
          </span>
        )}
      </button>

      <span className="flex justify-end px-3 pb-2">
        <button
          type="button"
          onClick={onOpen}
          aria-label={ingredientPropertiesName(ingredient.nameRu)}
          className={`min-h-11 px-3 text-xs font-medium text-action ${SURFACE_CONTROL}`}
        >
          {PROPERTIES_BUTTON}
        </button>
      </span>
    </li>
  );
}

export function AlchemyScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;
  const { crafting, choices } = snapshot;

  const [draft, setDraft] = useState<RecipeDraft>(() => emptyDraft(choices.recipeForm.standard));
  const [portionsText, setPortionsText] = useState("1");
  const [rolledText, setRolledText] = useState("");
  const [mishapText, setMishapText] = useState("");
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [refusalRu, setRefusalRu] = useState<string | null>(null);

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setRefusalRu(null);
            setWorkshopOpen(true);
          }}
          className={`flex flex-col gap-1 p-3 text-left ${SURFACE_GROUP}`}
        >
          <span className="text-sm font-semibold leading-tight">{WORKSHOP_TITLE}</span>

          <span className="text-xs leading-snug text-ink-quiet">
            {crafting.workshop.apparatusRu ?? NO_KIT}
          </span>
        </button>

        <QuickAddField
          labelRu="Записать вид"
          onAdd={(nameRu) => send({ kind: "note_ingredient", nameRu }, () => undefined)}
        />

        {crafting.ingredients.length === 0 ? (
          <p className="text-sm text-ink-quiet">
            Об ингредиентах пока ничего не записано. Здесь встанут виды и раскрытые у них свойства;
            сколько порций лежит в сумке, отвечают «Вещи».
          </p>
        ) : (
          <ul aria-label="Знание об ингредиентах" className="flex flex-col gap-2">
            {crafting.ingredients.map((ingredient) => (
              <KnownIngredient
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

        {crafting.ingredients.length === 0 ? null : (
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
          ingredient={openedIngredient}
          choices={choices}
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
