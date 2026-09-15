"use client";

import type { ReactNode } from "react";

import type { BagView } from "@/contract/views";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { CoinsEditor } from "@/ui/entities/character/ui/CoinsEditor";
import { RULE_EDGE_BOTTOM } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

const MONEY_RU = "Деньги";

const BETWEEN = " · ";

/**
 * Кошелёк строкой: он же и вход в правку — три поля номиналов раскрываются под ней. Отдельной
 * кнопки «правка» тут нет: деньги правят чаще, чем на них смотрят.
 */
export function Purse({
  money,
  opened,
  aside = null,
  onToggle,
  onWrite,
}: {
  money: BagView["money"];
  opened: boolean;
  /** Соседнее нажатие в той же строке: у денег и сита один поясок над списком. */
  aside?: ReactNode;
  onToggle: () => void;
  onWrite: (coins: Readonly<Record<string, number>>) => void;
}) {
  const lineRu = money
    .map(({ currency, amount }) => `${amount} ${currencyAbbr(currency)}`)
    .join(BETWEEN);

  return (
    <div className="flex shrink-0 flex-col">
      <div className={`flex items-stretch ${RULE_EDGE_BOTTOM}`}>
        <button
          type="button"
          aria-label={MONEY_RU}
          aria-expanded={opened}
          onClick={onToggle}
          className={`flex min-h-11 min-w-0 flex-1 items-center px-3 text-left text-[0.8125rem] tabular-nums ${
            opened ? SURFACE_GROUP_BARE : ""
          }`}
        >
          {lineRu}
        </button>
        {aside}
      </div>
      {!opened ? null : (
        <div className={`px-3 py-2 ${SURFACE_GROUP_BARE} ${RULE_EDGE_BOTTOM}`}>
          <CoinsEditor
            titleRu={MONEY_RU}
            currencies={money.map(({ currency }) => currency)}
            coins={Object.fromEntries(money.map(({ currency, amount }) => [currency, amount]))}
            onWrite={onWrite}
            onCancel={onToggle}
          />
        </div>
      )}
    </div>
  );
}
