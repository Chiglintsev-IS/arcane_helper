"use client";

import type { ChoicesView, KnownRecipeView } from "@/contract/views";

import {
  difficultyRu,
  formulaAsideRu,
  goldPerHourRu,
  minutesRu,
} from "@/ui/entities/crafting/lib/labels";
import { RULE_BLOCK } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

const DIFFICULTY_LABEL = "СЛ";
const TIME_LABEL = "ВРЕМЯ";
const CONSUMABLES_LABEL = "РАСХОДНИКИ";

const TO_BENCH = "На верстак";

const STANDARD_FORM = "стандартная форма";

const SEPARATOR = " · ";

function apparatusNeedRu(difficulty: number, unpriced: boolean): string {
  return `нужен набор на сложность ${difficultyRu(difficulty, unpriced)}`;
}

function Tile({ labelRu, valueRu }: { labelRu: string; valueRu: string }) {
  return (
    <span className={`flex min-w-0 flex-1 flex-col gap-0.5 p-2 ${SURFACE_CONTROL}`}>
      <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">{labelRu}</span>
      <span className="text-xs leading-tight">{valueRu}</span>
    </span>
  );
}

/**
 * Записанный рецепт: формула, которую отряд однажды разработал. Карточка не смотрит на нынешний
 * набор — она называет цену замысла и то, какого оснащения он требует.
 */
export function RecipeList({
  recipes,
  standard,
  onToBench,
}: {
  recipes: readonly KnownRecipeView[];
  standard: ChoicesView["recipeForm"]["standard"];
  onToBench: (recipe: KnownRecipeView) => void;
}) {
  return (
    <ul className="flex flex-col gap-2 p-3">
      {recipes.map((recipe) => {
        const aside = formulaAsideRu(recipe.formula, standard);
        return (
          <li
            key={recipe.nameRu}
            className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP_BARE} ${RULE_BLOCK}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.96875rem] font-semibold leading-tight">
                  {recipe.nameRu}
                </span>
                <span className="text-[0.6875rem] leading-snug text-ink-soft">
                  {recipe.kindsRu.join(SEPARATOR)}
                </span>
              </span>

              {recipe.difficulty === null ? null : (
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">
                    {DIFFICULTY_LABEL}
                  </span>
                  <span className="text-[1.75rem] font-semibold leading-none tabular-nums">
                    {difficultyRu(recipe.difficulty, recipe.unpriced)}
                  </span>
                </span>
              )}
            </div>

            <span className="text-[0.71875rem] leading-snug text-ink-quiet">
              {aside.length === 0 ? STANDARD_FORM : aside.join(SEPARATOR)}
            </span>

            {recipe.refusalRu !== null ? (
              <span className="text-xs leading-snug text-reaction">{recipe.refusalRu}</span>
            ) : (
              <div className="flex items-stretch gap-1">
                <Tile
                  labelRu={TIME_LABEL}
                  valueRu={recipe.minutes === null ? "" : minutesRu(recipe.minutes)}
                />
                <Tile
                  labelRu={CONSUMABLES_LABEL}
                  valueRu={
                    recipe.consumablesRu === null || recipe.goldPerStartedHour === null
                      ? ""
                      : `${recipe.consumablesRu.toLocaleLowerCase("ru")}${SEPARATOR}${goldPerHourRu(
                          recipe.goldPerStartedHour,
                        )}`
                  }
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-[0.6875rem] text-ink-quiet">
                {recipe.difficulty === null
                  ? ""
                  : apparatusNeedRu(recipe.difficulty, recipe.unpriced)}
              </span>
              <button
                type="button"
                onClick={() => onToBench(recipe)}
                className={`min-h-11 shrink-0 px-3 text-xs ${SURFACE_CONTROL}`}
              >
                {TO_BENCH}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
