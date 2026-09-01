"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import { CHECK_DIE_RU, MISHAP_DIE_RU } from "@/shared/language";
import { DIRECTION_LABELS } from "@/ui/entities/crafting/lib/labels";
import { labelled, propertyNumberRu, rarityLabel } from "@/ui/shared/lib/alchemyLabels";
import { WorkshopSheet } from "@/ui/features/edit-workshop/ui/WorkshopSheet";
import {
  RevealPropertySheet,
  revealPropertyName,
} from "@/ui/features/reveal-property/ui/RevealPropertySheet";
import { RecipeBench, type RecipeDraft } from "@/ui/widgets/recipe-bench/ui/RecipeBench";
import { applyEdit } from "@/ui/shared/model/editing";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { usePreview } from "@/ui/shared/model/usePreview";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const WORKSHOP_TITLE = "Мастерская";

const NOTHING_OPEN = "Все направления закрыты";

const NO_KIT = "набора нет, работа импровизацией";

const STUDIED = "изучено";

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
    <li className="flex items-start gap-2">
      <button
        type="button"
        aria-pressed={chosen}
        onClick={onChoose}
        className={`flex min-w-0 flex-1 flex-col gap-2 p-3 text-left ${
          chosen ? SURFACE_CONTROL : SURFACE_GROUP
        }`}
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
                <span className="shrink-0 text-xs text-ink-quiet">
                  {rarityLabel(property.rarity)}
                </span>
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
      <button
        type="button"
        onClick={onOpen}
        aria-label={revealPropertyName(ingredient.nameRu)}
        className={`min-h-11 min-w-11 shrink-0 text-lg ${SURFACE_GROUP}`}
      >
        <span aria-hidden="true">+</span>
      </button>
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

  const nameRarity = (propertyRu: string, rarity: string): void => {
    if (rarity === "") return;
    send({ kind: "name_rarity", propertyRu, rarity }, () => undefined);
  };

  const openedIngredient = crafting.ingredients.find((one) => one.itemId === opened);

  const { apparatus, studiedDirections, closedDirections } = crafting.workshop;

  const openDirections = choices.alchemyDirections
    .filter((direction) => !closedDirections.some((closed) => closed.direction === direction))
    .map((direction) => ({
      nameRu: labelled(DIRECTION_LABELS, direction),
      toolRu: [
        apparatus.find((kit) => kit.direction === direction)?.gradeRu ?? NO_KIT,
        ...(studiedDirections.includes(direction) ? [STUDIED] : []),
      ].join(" · "),
    }));

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

          <span className="flex flex-col text-xs">
            {openDirections.length === 0 ? (
              <span className="text-ink-quiet">{NOTHING_OPEN}</span>
            ) : (
              openDirections.map((direction) => (
                <span key={direction.nameRu} className="leading-snug text-ink-quiet">
                  {direction.nameRu} — {direction.toolRu}
                </span>
              ))
            )}
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
            rarities={choices.alchemicalRarities}
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
            onNameRarity={nameRarity}
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
          onConfirm={(command) => send(command, () => setOpened(null))}
          onNameRarity={nameRarity}
          onExhausted={(exhausted) =>
            send(
              { kind: "mark_properties_exhausted", itemId: openedIngredient.itemId, exhausted },
              () => undefined,
            )
          }
          onNoteObservation={(textRu) =>
            send({ kind: "note_observation", itemId: openedIngredient.itemId, textRu }, () =>
              undefined,
            )
          }
          onRewriteObservation={(observationId, textRu) =>
            send(
              {
                kind: "rewrite_observation",
                itemId: openedIngredient.itemId,
                observationId,
                textRu,
              },
              () => undefined,
            )
          }
          onDropObservation={(observationId) =>
            send(
              { kind: "drop_observation", itemId: openedIngredient.itemId, observationId },
              () => undefined,
            )
          }
          onCancel={() => {
            setRefusalRu(null);
            setOpened(null);
          }}
        />
      )}
    </div>
  );
}
