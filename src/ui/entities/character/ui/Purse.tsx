"use client";

import type { BagView } from "@/contract/views";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { EDIT_LABEL, editName } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const MONEY_RU = "Деньги";

export function Purse({
  money,
  onEdit,
}: {
  money: BagView["money"];
  onEdit: () => void;
}) {
  return (
    <section className={`flex items-center gap-3 px-3 py-2 ${SURFACE_GROUP}`}>
      <h2 className="shrink-0 text-sm font-semibold">{MONEY_RU}</h2>
      <ul
        aria-label="Кошелёк"
        className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums"
      >
        {money.map(({ currency, amount }) => (
          <li key={currency}>
            <span className="text-ink-quiet">{currencyAbbr(currency)}</span> {amount}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onEdit}
        aria-label={editName(MONEY_RU)}
        className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
      >
        {EDIT_LABEL}
      </button>
    </section>
  );
}
