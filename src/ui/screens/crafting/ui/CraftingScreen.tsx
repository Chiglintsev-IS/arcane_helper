"use client";

import type { IngredientKnowledgeView } from "@/contract/views";

import { useSession } from "@/ui/shared/model/storeContext";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/** Ступени редкости словами: перечень приходит словом правил, подпись к слову выбирает экран. */
const RARITY_LABELS: Readonly<Record<string, string>> = {
  common: "обычное",
  uncommon: "необычное",
  rare: "редкое",
  veryRare: "очень редкое",
  legendary: "легендарное",
};

/**
 * Счёт раскрытого называется без знаменателя: сколько у вида свойств всего, приложение не знает.
 *
 * Потолок правил фактом вида не является, и «два из четырёх» у вида с двумя свойствами осталось бы
 * навсегда — ошибку эту видно не сразу, а в тот час, когда на неё положились.
 */
function revealedCountRu(count: number): string {
  return `раскрыто ${count} · следующее не исследовано`;
}

/** Номер свойства ординалом: он говорит, насколько глубоко оно было скрыто, а не сколько его. */
function propertyNumberRu(number: number): string {
  return `${number}-е`;
}

function KnownIngredient({ ingredient }: { ingredient: IngredientKnowledgeView }) {
  return (
    <li className={`flex flex-col gap-2 rounded-xl p-3 ${SURFACE_GROUP}`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold leading-tight">{ingredient.nameRu}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {revealedCountRu(ingredient.properties.length)}
        </span>
      </div>

      {ingredient.properties.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {ingredient.properties.map((property) => (
            <li key={property.number} className="flex items-start gap-2">
              <span
                className={`flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400 ${SURFACE_CONTROL}`}
              >
                {propertyNumberRu(property.number)}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-tight">{property.nameRu}</span>
              <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">
                {RARITY_LABELS[property.rarity] ?? property.rarity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CraftingScreen() {
  const { crafting } = useSession((state) => state.snapshot)!;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      {crafting.ingredients.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Об ингредиентах пока ничего не записано. Здесь встанут виды и раскрытые у них свойства;
          сколько порций лежит в сумке, отвечают «Вещи».
        </p>
      ) : (
        <ul aria-label="Знание об ингредиентах" className="flex flex-col gap-2">
          {crafting.ingredients.map((ingredient) => (
            <KnownIngredient key={ingredient.nameRu} ingredient={ingredient} />
          ))}
        </ul>
      )}
    </div>
  );
}
