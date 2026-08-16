"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { ChoicesView, IngredientKnowledgeView } from "@/contract/views";

import { CHECK_DIE_RU, MISHAP_DIE_RU } from "@/shared/language";
import {
  DIRECTION_LABELS,
  RARITY_LABELS,
  labelled,
  propertyNumberRu,
} from "@/ui/entities/crafting/lib/labels";
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

/**
 * «Ремесло»: что игрок узнал об ингредиентах и что из этого выйдет.
 *
 * Список знания и есть выбор состава: второй такой же список с теми же названиями отнял бы место и
 * заставил бы читать одно и то же дважды. Отмеченные строки собираются на верстак, и там же ядро
 * называет сложность, партию и причину, по которой работа не идёт.
 */

/** Пустой замысел: стандартную форму называют правила, состав и удалённое набирает игрок. */
function emptyDraft(standard: ChoicesView["recipeForm"]["standard"]): RecipeDraft {
  return { ...standard, kinds: [], mainProperty: null, suppressed: [], limitations: [] };
}

/**
 * Счёт раскрытого. Знаменатель у него берётся только от отметки стола: сколько у вида свойств
 * всего, приложение не знает, и потолок правил фактом вида не является.
 */
function revealedCountRu(ingredient: IngredientKnowledgeView): string {
  const count = ingredient.properties.length;
  return ingredient.propertiesExhausted
    ? `раскрыто ${count} из ${count}`
    : `раскрыто ${count} · следующее не исследовано`;
}

/**
 * Отметка состава стоит в той же строке, что и счёт раскрытого.
 *
 * Словом, а не одной лишь ступенью подложки: разница ступеней на тёмной теме видна хуже, чем
 * кажется при свете, а второй строкой отметка отняла бы место у каждого вида разом.
 */
function chosenMarkRu(chosen: boolean, ingredient: IngredientKnowledgeView): string {
  const revealed = revealedCountRu(ingredient);
  return chosen ? `в составе · ${revealed}` : revealed;
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
        className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl p-3 text-left ${
          chosen ? SURFACE_CONTROL : SURFACE_GROUP
        }`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold leading-tight">{ingredient.nameRu}</span>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {chosenMarkRu(chosen, ingredient)}
          </span>
        </span>

        {ingredient.properties.length === 0 ? null : (
          <span className="flex flex-col gap-1">
            {ingredient.properties.map((property) => (
              <span key={property.number} className="flex items-start gap-2">
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                  {propertyNumberRu(property.number)}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-tight">{property.nameRu}</span>
                <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">
                  {labelled(RARITY_LABELS, property.rarity)}
                </span>
              </span>
            ))}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={revealPropertyName(ingredient.nameRu)}
        className={`min-h-11 min-w-11 shrink-0 rounded-xl text-lg ${SURFACE_GROUP}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </li>
  );
}

export function CraftingScreen() {
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
      : { kind: "recipe_preview", formula: { ...draft }, portions };
  const answer = usePreview(question);
  const preview: PreviewOf<"recipe_preview"> | null =
    answer?.kind === "recipe_preview" ? answer : null;

  const choose = (nameRu: string): void =>
    setDraft({
      ...draft,
      kinds: draft.kinds.includes(nameRu)
        ? draft.kinds.filter((kind) => kind !== nameRu)
        : [...draft.kinds, nameRu],
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

  /** Отказ остаётся в той шторке, в которой набирали; удача её закрывает. */
  const send = (command: Command, close: () => void): void => {
    void applyEdit(sessionStore, command).then((reason) => {
      setRefusalRu(reason);
      if (reason === null) close();
    });
  };

  /** Открытый вид берётся из снимка заново: записанное в шторке видно ей самой сразу. */
  const openedIngredient = crafting.ingredients.find((one) => one.nameRu === opened);

  const kits = crafting.workshop.apparatus
    .map((kit) => `${labelled(DIRECTION_LABELS, kit.direction)} — ${kit.gradeRu}`)
    .join("; ");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setRefusalRu(null);
            setWorkshopOpen(true);
          }}
          className={`flex min-h-11 flex-col gap-0.5 rounded-xl p-3 text-left ${SURFACE_GROUP}`}
        >
          <span className="text-sm font-semibold leading-tight">Мастерская</span>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {kits === ""
              ? "Наборов не записано: работа идёт импровизированными сосудами"
              : kits}
          </span>
        </button>

        <QuickAddField
          labelRu="Записать вид"
          onAdd={(nameRu) => send({ kind: "note_ingredient", nameRu }, () => undefined)}
        />

        {crafting.ingredients.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Об ингредиентах пока ничего не записано. Здесь встанут виды и раскрытые у них свойства;
            сколько порций лежит в сумке, отвечают «Вещи».
          </p>
        ) : (
          <ul aria-label="Знание об ингредиентах" className="flex flex-col gap-2">
            {crafting.ingredients.map((ingredient) => (
              <KnownIngredient
                key={ingredient.nameRu}
                ingredient={ingredient}
                chosen={draft.kinds.includes(ingredient.nameRu)}
                onChoose={() => choose(ingredient.nameRu)}
                onOpen={() => {
                  setRefusalRu(null);
                  setOpened(ingredient.nameRu);
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
          onConfirm={(command) => send(command, () => setOpened(null))}
          onExhausted={(exhausted) =>
            send(
              { kind: "mark_properties_exhausted", nameRu: openedIngredient.nameRu, exhausted },
              () => undefined,
            )
          }
          onForget={() =>
            send({ kind: "forget_ingredient", nameRu: openedIngredient.nameRu }, () =>
              setOpened(null),
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
