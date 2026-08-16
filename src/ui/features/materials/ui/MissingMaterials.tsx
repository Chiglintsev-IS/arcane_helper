/**
 * Покупки: что придётся купить перед вылазкой.
 *
 * Собственного заголовка у них нет — их называет переключатель, которым их и открывают. Стоит здесь
 * всё нужное, чего в сумке нет: и то, чего не заводили ни разу, и заведённое, чей запас
 * опустел. Второе приезжает со своей записью и из своей категории на это время уходит: ноль перед
 * вылазкой ищут в списке покупок, а не по категориям. Числа запаса нет ни у одной строки — каждая
 * стоит здесь именно потому, что запаса нет, и ноль при каждом имени повторял бы имя самих покупок.
 *
 * Строки устроены одинаково, заведена вещь или ещё нет: то же имя, те же подробности, то же
 * прибавление в сумку одним нажатием. Заведённая сверх того открывается своей шторкой; незаведённой
 * открывать нечего, и открывающего действия у неё нет вовсе, а не есть погашенное.
 *
 * Закрытое надетой фокусировкой названо одним перечнем имён: покупать его не обязательно, а строка
 * на каждое заняла бы половину экрана под то, чем не пользуются, — при том что знать о нём надо,
 * фокусировку снимают.
 */

"use client";

import type { MissingMaterialView } from "@/contract/views";
import { neededForLine } from "@/ui/entities/character/lib/itemMeta";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Тело строки: одно и то же у заведённой вещи и у той, которой ещё нет. */
const ROW = "block min-h-11 min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left";

/** Подробности требования: цена, судьба, те, кто его называет, и написанное рукой. */
function detailsRu(need: MissingMaterialView): string {
  return [
    need.price === undefined ? null : `${need.price.amount} ${currencyAbbr(need.price.currency)}`,
    need.consumed ? "расходуется" : null,
    neededForLine(need.neededForRu),
    need.note ?? null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function RowBody({ need }: { need: MissingMaterialView }) {
  return (
    <>
      <span className="block text-sm font-medium">{need.nameRu}</span>
      <span className="mt-1 block text-xs leading-snug text-slate-600 dark:text-slate-400">
        {detailsRu(need)}
      </span>
    </>
  );
}

export function MissingMaterials({
  missing,
  onBuy,
  onOpenItem,
  onRefill,
}: {
  missing: readonly MissingMaterialView[];
  /** Завести компонент карточки и положить одну штуку в сумку. */
  onBuy: (spellId: string) => void;
  /** Открыть заведённую вещь целиком: правка, запас и удаление живут в её шторке. */
  onOpenItem: (itemId: string) => void;
  /** Положить одну штуку заведённой вещи: тот же плюс, каким её пополняют в категории. */
  onRefill: (itemId: string) => void;
}) {
  const rows = missing.filter((need) => !need.coveredByFocus);
  const covered = missing.filter((need) => need.coveredByFocus);

  const add = (need: MissingMaterialView): void =>
    need.itemId === undefined ? onBuy(need.spellId) : onRefill(need.itemId);

  return (
    <div className="flex flex-col gap-1">
      {missing.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">Всё нужное лежит в сумке.</p>
      ) : null}

      {rows.length === 0 ? null : (
        <ul aria-label="Купить" className="flex flex-col gap-0.5">
          {rows.map((need) => {
            const itemId = need.itemId;
            return (
              <li key={need.nameRu} className="flex items-center gap-2">
                {itemId === undefined ? (
                  <span className={ROW}>
                    <RowBody need={need} />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Открыть: ${need.nameRu}`}
                    onClick={() => onOpenItem(itemId)}
                    className={`${ROW} hover:bg-slate-100 dark:hover:bg-slate-900`}
                  >
                    <RowBody need={need} />
                  </button>
                )}

                <button
                  type="button"
                  aria-label={`Добавить один в сумку: ${need.nameRu}`}
                  onClick={() => add(need)}
                  className={`min-h-11 min-w-11 shrink-0 rounded-lg text-base ${SURFACE_CONTROL}`}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {covered.length === 0 ? null : (
        <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
          Закрывает фокусировка, покупать не обязательно:{" "}
          {covered.map((need) => need.nameRu).join(" · ")}
        </p>
      )}
    </div>
  );
}
