import type { Items } from "@/core/domain/items/items";
import { gearOnlyRefusal } from "@/core/domain/items/schema";
import { STAT_IDS } from "@/core/domain/shared/stats";
import type { ContributionSource, SourcedContribution } from "@/core/domain/shared/stats";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { assertMoney, assertStockEntry, MAXIMUM_ITEM_COUNT } from "./schema";
import type { EquipmentData, Money, StockEntry } from "./schema";

type EquipmentState = { equipment: EquipmentData };

function withStock(entries: readonly StockEntry[], itemId: string, count: number): readonly StockEntry[] {
  assertStockEntry({ itemId, count });
  const found = entries.some((entry) => entry.itemId === itemId);
  if (!found) return [...entries, { itemId, count }];
  return entries.map((entry) => (entry.itemId === itemId ? { ...entry, count } : entry));
}

export class Equipment {
  private static readonly KEYS = ["equipment"] as const satisfies readonly (keyof EquipmentState)[];

  private constructor(private readonly state: EquipmentState) {}

  static of(state: EquipmentState): Equipment {
    return new Equipment(ownedFields(state, Equipment.KEYS));
  }

  private get data(): EquipmentData {
    return this.state.equipment;
  }

  private with(change: Partial<EquipmentData>): Equipment {
    return new Equipment({ equipment: { ...this.data, ...change } });
  }

  get money(): Money {
    return this.data.money;
  }

  bagCount(itemId: string): number {
    return this.data.bag.find((entry) => entry.itemId === itemId)?.count ?? 0;
  }

  wornCount(itemId: string): number {
    return this.data.worn.find((entry) => entry.itemId === itemId)?.count ?? 0;
  }

  contributions(items: Items): readonly SourcedContribution[] {
    return this.data.worn.flatMap((entry) => {
      if (entry.count <= 0) return [];
      const item = items.find(entry.itemId);
      if (item === undefined || item.kind !== "gear") return [];

      const source: ContributionSource = { origin: "item", nameRu: item.nameRu };
      const armor: SourcedContribution[] =
        item.armor === undefined
          ? []
          : [
              {
                source,
                contribution: {
                  stat: "armorClass",
                  kind: "method",
                  method: { family: "armor", base: item.armor.base, category: item.armor.category },
                },
              },
            ];
      const bonuses: SourcedContribution[] = STAT_IDS.flatMap((stat) => {
        const value = item.bonuses?.[stat];
        return value === undefined
          ? []
          : [{ source, contribution: { stat, kind: "bonus", value } }];
      });

      return [...armor, ...bonuses];
    });
  }

  get known(): boolean {
    return this.data.components !== undefined;
  }

  replacesFreeComponents(items: Items): boolean {
    return this.wearsSpellcastingFocus(items) || this.data.components?.componentPouch === true;
  }

  private wearsSpellcastingFocus(items: Items): boolean {
    return this.data.worn.some(
      (entry) => entry.count > 0 && items.find(entry.itemId)?.spellcastingFocus === true,
    );
  }

  carries(itemId: string): boolean {
    return this.bagCount(itemId) > 0;
  }

  adjustBagCount(itemId: string, delta: number): Equipment {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new DomainError(`Приращение запаса должно быть целым и ненулевым, получено: ${delta}`);
    }
    const count = this.bagCount(itemId) + delta;
    if (count < 0) {
      throw new DomainError(`В сумке ${this.bagCount(itemId)}, столько не потратить`);
    }
    if (count > MAXIMUM_ITEM_COUNT) {
      throw new DomainError(`Больше ${MAXIMUM_ITEM_COUNT} не хранится`);
    }
    return this.with({ bag: withStock(this.data.bag, itemId, count) });
  }

  equip(itemId: string, count: number, items: Items): Equipment {
    if (!Number.isInteger(count) || count <= 0) {
      throw new DomainError(`Число вещи для надевания должно быть целым и положительным, получено: ${count}`);
    }
    const item = items.find(itemId);
    if (item === undefined) throw new DomainError(`Вещи «${itemId}» нет среди заведённых`);
    if (item.kind !== "gear") throw new DomainError(gearOnlyRefusal(item.nameRu));

    const inBag = this.bagCount(itemId);
    if (count > inBag) {
      throw new DomainError(`«${item.nameRu}»: в сумке ${inBag}, надеть больше нельзя`);
    }
    return this.with({
      bag: withStock(this.data.bag, itemId, inBag - count),
      worn: withStock(this.data.worn, itemId, this.wornCount(itemId) + count),
    });
  }

  unequip(itemId: string, count: number): Equipment {
    if (!Number.isInteger(count) || count <= 0) {
      throw new DomainError(`Число вещи для снятия должно быть целым и положительным, получено: ${count}`);
    }
    const wornNow = this.wornCount(itemId);
    if (count > wornNow) {
      throw new DomainError(`Надето ${wornNow}, снять больше нельзя`);
    }
    return this.with({
      worn: withStock(this.data.worn, itemId, wornNow - count),
      bag: withStock(this.data.bag, itemId, this.bagCount(itemId) + count),
    });
  }

  withMoney(money: Money): Equipment {
    assertMoney(money);
    return this.with({ money });
  }

  toState(): EquipmentState {
    return this.state;
  }
}

