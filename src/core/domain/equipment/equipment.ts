/**
 * Снаряжение: чем персонаж располагает вещественно.
 *
 * Отдельно от книги заклинаний намеренно. Книга отвечает на вопрос «что я умею», снаряжение — «что у
 * меня есть»; связывает их сотворение, которому нужно и то, и другое.
 *
 * Отдельно от персонажа — по той же причине. «+1 к магии» и надетый доспех принадлежат вещи, а не
 * Торну: положенные на лист персонажа, они делали бы КС и КД свойствами тела, и снять предмет
 * значило бы править характеристики.
 *
 * Отдельно от вещей — по третьей причине. Вещь отвечает «что это такое», снаряжение — «сколько
 * этого у меня и что из этого на мне»: свою природу — категорию, прибавки, базу доспеха — снаряжение
 * не хранит, а находит по названию у вещей и спрашивает.
 */

import type { Items } from "@/core/domain/items/items";
import { gearOnlyRefusal } from "@/core/domain/items/schema";
import type { ItemDefinition } from "@/core/domain/items/schema";
import type { ItemBonuses } from "@/core/domain/shared/schema";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { assertMoney, MAXIMUM_ITEM_COUNT } from "./schema";
import type { EquipmentData, Money, StockEntry } from "./schema";

type EquipmentState = { equipment: EquipmentData };

/** База Класса Доспеха без доспехов — правило игры, а не настройка. */
export const UNARMORED_ARMOR_CLASS_BASE = 10;

const NO_BONUSES: ItemBonuses = { spellcasting: 0, armorClass: 0, savingThrows: 0 };

/** Тот же запас с одной изменённой записью: заводит запись, если её ещё не было. */
function withStock(entries: readonly StockEntry[], itemId: string, count: number): readonly StockEntry[] {
  const found = entries.some((entry) => entry.itemId === itemId);
  if (!found) return count === 0 ? entries : [...entries, { itemId, count }];
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

  get bag(): readonly StockEntry[] {
    return this.data.bag;
  }

  get worn(): readonly StockEntry[] {
    return this.data.worn;
  }

  get money(): Money {
    return this.data.money;
  }

  /** Сколько вещи лежит в сумке — ноль, если записи вовсе нет. */
  bagCount(itemId: string): number {
    return this.data.bag.find((entry) => entry.itemId === itemId)?.count ?? 0;
  }

  /** Сколько вещи надето — ноль, если записи вовсе нет. */
  wornCount(itemId: string): number {
    return this.data.worn.find((entry) => entry.itemId === itemId)?.count ?? 0;
  }

  /**
   * Надетый доспех, задающий базу КД: из надетой экипировки с базой берётся наибольшая.
   *
   * Замены базы не складываются — то же правило, что у «Доспехов мага» против кольчуги: вторая
   * кираса поверх первой защищает не лучше.
   */
  wornArmor(items: Items): ItemDefinition | undefined {
    return this.data.worn.reduce<ItemDefinition | undefined>((best, entry) => {
      const item = entry.count > 0 ? items.find(entry.itemId) : undefined;
      return item !== undefined &&
        item.kind === "gear" &&
        item.armorBase !== undefined &&
        item.armorBase > (best?.armorBase ?? 0)
        ? item
        : best;
    }, undefined);
  }

  /** База Класса Доспеха — производная от надетого: доспех или его отсутствие. */
  armorClassBase(items: Items): number {
    return this.wornArmor(items)?.armorBase ?? UNARMORED_ARMOR_CLASS_BASE;
  }

  /**
   * Что снаряжение прибавляет к числам: надетые вещи, и только они.
   *
   * Лежащее в сумке не считается: кольцо в мешке защиты не даёт, и число, выросшее от покупки,
   * разошлось бы с тем, что действует за столом. Прибавка без вещи — свойство персонажа, а не
   * снаряжения, и живёт у него.
   */
  bonuses(items: Items): ItemBonuses {
    return this.data.worn.reduce<ItemBonuses>((total, entry) => {
      if (entry.count <= 0) return total;
      const item = items.find(entry.itemId);
      if (item === undefined || item.kind !== "gear" || item.bonuses === undefined) return total;
      return {
        spellcasting: total.spellcasting + item.bonuses.spellcasting,
        armorClass: total.armorClass + item.bonuses.armorClass,
        savingThrows: total.savingThrows + item.bonuses.savingThrows,
      };
    }, { ...NO_BONUSES });
  }

  /**
   * Заведены ли сведения о компонентах.
   *
   * Состояние могло прийти выгрузкой из сборки, которая про них не знала. Тогда вердикта о
   * компонентах нет вовсе: «компонента нет» было бы выдумкой про чужого персонажа.
   */
  get known(): boolean {
    return this.data.components !== undefined;
  }

  /** Заменяет ли что-нибудь материальные компоненты без стоимости. */
  get replacesFreeComponents(): boolean {
    const { components } = this.data;
    return components !== undefined && (components.spellcastingFocus || components.componentPouch);
  }

  /** Лежит ли в сумке дорогой компонент конкретного заклинания: фокусировка его не заменяет. */
  hasMaterialFor(spellId: string): boolean {
    return this.data.components?.materialsForSpellIds.includes(spellId) === true;
  }

  toggleMaterial(spellId: string): { equipment: Equipment; owned: boolean } {
    const { components } = this.data;
    if (components === undefined) {
      throw new DomainError("У персонажа не заведено снаряжение");
    }
    const owned = components.materialsForSpellIds.includes(spellId);
    return {
      equipment: this.with({
        components: {
          ...components,
          materialsForSpellIds: owned
            ? components.materialsForSpellIds.filter((id) => id !== spellId)
            : [...components.materialsForSpellIds, spellId],
        },
      }),
      owned: !owned,
    };
  }

  /**
   * Меняет запас вещи в сумке на приращение — расход или пополнение, включая первое подбирание.
   *
   * Ноль — состояние, а не отсутствие: кончившееся зелье остаётся строкой с нулём, чтобы было
   * видно, что оно кончилось, а не забыто. Убирается запись только явной правкой на ноль сверху.
   */
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

  /**
   * Надевает вещь: переносит счёт из сумки в надетое. Надевается только экипировка, и не больше,
   * чем в сумке есть — вторая рубаха из воздуха не берётся.
   */
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

  /** Снимает вещь: переносит счёт из надетого в сумку. Снять можно не больше, чем надето. */
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

