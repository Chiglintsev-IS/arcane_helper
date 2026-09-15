"use client";

import type { BagView, ItemView } from "@/contract/views";
import { coinsRu as namedCoinsRu, withPlural } from "@/shared/language";
import { DASH } from "@/ui/entities/character/lib/labels";
import { RULE_BETWEEN, RULE_EDGE_BOTTOM } from "@/ui/shared/ui/rule";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const TITLE = "Нужно на всё";

const PURSE_RU = "в кошельке";

const REST_RU = "останется";

const SHORT_RU = "не хватает";

const BOUGHT_MARK = "✓";

const TO_BUY_MARK = "○";

const EMPTY = "Купить пока нечего.";

const PRICE_FORMS: [string, string, string] = [
  "запись без цены",
  "записи без цены",
  "записей без цены",
];

const BETWEEN = " · ";

function coinsRu(coins: BagView["money"]): string {
  const namedRu = namedCoinsRu(coins.map(({ currency, amount }) => ({ currency, amount: Math.abs(amount) })));
  return namedRu === "" ? DASH : namedRu;
}

/**
 * Покупки: что отмечено к покупке, чего это стоит и что от кошелька останется. Отметка купленного
 * кладёт вещь в рюкзак — потому список и не спрашивает подтверждения: возврат делает журнал.
 */
export function Shopping({
  items,
  money,
  shopping,
  bought,
  onBuy,
}: {
  items: readonly ItemView[];
  money: BagView["money"];
  shopping: BagView["shopping"];
  bought: readonly string[];
  onBuy: (id: string) => void;
}) {
  const restRu = coinsRu(shopping.rest.filter(({ amount }) => (shopping.short ? amount < 0 : amount > 0)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex shrink-0 items-end gap-3 px-3 py-2.5 ${RULE_EDGE_BOTTOM}`}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.625rem] uppercase tracking-wider text-ink-quiet">{TITLE}</span>
          <span className="text-[0.6875rem] text-ink-soft">
            {PURSE_RU} {coinsRu(money)}
          </span>
          <span
            className={`text-[0.6875rem] ${shopping.short ? TONE_TEXT.reaction : "text-ink-soft"}`}
          >
            {shopping.short ? SHORT_RU : REST_RU} {restRu}
          </span>
          {shopping.unpriced === 0 ? null : (
            <span className="text-[0.625rem] text-ink-quiet">
              {withPlural(shopping.unpriced, PRICE_FORMS)}
            </span>
          )}
        </span>
        <span className="shrink-0 text-lg font-semibold leading-none tabular-nums">
          {coinsRu(shopping.cost)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-quiet">{EMPTY}</p>
        ) : (
          <ul aria-label={TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
            {items.map((item) => {
              const taken = bought.includes(item.id);
              const whereRu = item.notes.map((note) => note.textRu).join(BETWEEN);
              return (
                <li key={item.id} className="flex">
                  <button
                    type="button"
                    aria-pressed={taken}
                    aria-label={`Купить: ${item.nameRu}`}
                    disabled={taken}
                    onClick={() => onBuy(item.id)}
                    className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-sm ${taken ? "text-accent" : "text-ink-quiet"}`}
                    >
                      {taken ? BOUGHT_MARK : TO_BUY_MARK}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-sm leading-tight ${taken ? "text-off" : ""}`}>
                        {item.nameRu}
                      </span>
                      {whereRu === "" ? null : (
                        <span className="text-[0.65rem] leading-snug text-ink-quiet">{whereRu}</span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-[0.8125rem] font-semibold tabular-nums ${
                        taken ? "text-off" : ""
                      }`}
                    >
                      {item.price === undefined ? DASH : coinsRu(item.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
