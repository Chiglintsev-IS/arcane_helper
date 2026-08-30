"use client";

import type { MissingMaterialView } from "@/contract/views";
import { neededForLine } from "@/ui/entities/character/lib/itemMeta";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const ROW = "block min-h-11 min-w-0 flex-1 px-1 py-1.5 text-left";

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
      <span className="mt-1 block text-xs leading-snug text-ink-quiet">
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
  onBuy: (spellId: string) => void;
  onOpenItem: (itemId: string) => void;
  onRefill: (itemId: string) => void;
}) {
  const rows = missing.filter((need) => !need.coveredByFocus);
  const covered = missing.filter((need) => need.coveredByFocus);

  const add = (need: MissingMaterialView): void =>
    need.itemId === undefined ? onBuy(need.spellId) : onRefill(need.itemId);

  return (
    <div className="flex flex-col gap-1">
      {missing.length === 0 ? (
        <p className="text-xs text-ink-quiet">Всё нужное лежит в сумке.</p>
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
                    aria-label={editName(need.nameRu)}
                    onClick={() => onOpenItem(itemId)}
                    className={`${ROW} hover:bg-control`}
                  >
                    <RowBody need={need} />
                  </button>
                )}

                <button
                  type="button"
                  aria-label={`Добавить один в сумку: ${need.nameRu}`}
                  onClick={() => add(need)}
                  className={`min-h-11 min-w-11 shrink-0 text-base ${SURFACE_CONTROL}`}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {covered.length === 0 ? null : (
        <p className="text-xs leading-snug text-ink-quiet">
          Закрывает фокусировка, покупать не обязательно:{" "}
          {covered.map((need) => need.nameRu).join(" · ")}
        </p>
      )}
    </div>
  );
}
