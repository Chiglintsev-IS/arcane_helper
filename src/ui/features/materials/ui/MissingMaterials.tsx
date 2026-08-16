/**
 * Раздел «Чего не хватает»: нужное, которого в сумке не заводили ни разу.
 *
 * Заведённая вещь сюда не попадает и с пустым запасом: она уже стоит строкой своего раздела — со
 * своим нулём, своим пополнением и своей шторкой, — и вторая её строка была бы тем же самым,
 * сказанным дважды.
 *
 * Строкой стоит то, без чего заклинание не сотворить. Закрытое надетой фокусировкой названо одним
 * перечнем имён: покупать его не обязательно, а строка на каждое заняла бы половину экрана под то,
 * чем не пользуются, — при том что знать о нём надо, фокусировку снимают.
 */

"use client";

import type { MissingMaterialView } from "@/contract/views";
import { neededForLine } from "@/ui/entities/character/lib/itemMeta";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { ItemSection } from "@/ui/shared/ui/ItemSection";

/** Подробности требования: цена, судьба и те, кто его называет. */
function detailsRu(need: MissingMaterialView): string {
  return [
    need.price === undefined ? null : `${need.price.amount} ${currencyAbbr(need.price.currency)}`,
    need.consumed ? "расходуется" : null,
    neededForLine(need.neededForRu),
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function MissingMaterials({
  missing,
  onBuy,
}: {
  missing: readonly MissingMaterialView[];
  /** Завести компонент карточки и положить одну штуку в сумку. */
  onBuy: (spellId: string) => void;
}) {
  const rows = missing.filter((need) => !need.coveredByFocus);
  const covered = missing.filter((need) => need.coveredByFocus);

  return (
    <ItemSection titleRu="Чего не хватает">
      {missing.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Всё нужное лежит в сумке.</p>
      ) : null}

      {rows.length === 0 ? null : (
        <ul aria-label="Купить" className="flex flex-col gap-0.5">
          {rows.map((need) => (
            <li key={need.nameRu} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 px-1 py-1.5">
                <span className="block text-sm font-medium">{need.nameRu}</span>
                <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {detailsRu(need)}
                </span>
              </span>

              <button
                type="button"
                aria-label={`Добавить один в сумку: ${need.nameRu}`}
                onClick={() => onBuy(need.spellId)}
                className="min-h-11 min-w-11 shrink-0 rounded-lg border border-slate-200 text-base dark:border-slate-800"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}

      {covered.length === 0 ? null : (
        <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
          Закрывает фокусировка, покупать не обязательно:{" "}
          {covered.map((need) => need.nameRu).join(" · ")}
        </p>
      )}
    </ItemSection>
  );
}
