import { CURRENCIES } from "@/core/domain/shared/schema";

type Coins = Readonly<Record<(typeof CURRENCIES)[number], number>>;

/** Монеты уходят на экран перечнем номиналов в одном и том же порядке: и цена, и кошелёк. */
export function coinsView(coins: Coins): { currency: string; amount: number }[] {
  return CURRENCIES.map((currency) => ({ currency, amount: coins[currency] }));
}
