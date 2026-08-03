/**
 * Снаряжение: чем персонаж располагает вещественно.
 *
 * Отдельно от книги заклинаний намеренно. Книга отвечает на вопрос «что я умею», снаряжение — «что у
 * меня есть»; связывает их сотворение, которому нужно и то, и другое.
 *
 * Отдельно от персонажа — по той же причине. «+1 к магии» и надетый доспех принадлежат вещи, а не
 * Торну: положенные на лист персонажа, они делали бы КС и КД свойствами тела, и снять предмет
 * значило бы править характеристики.
 */

import type { CharacterState, Equipment as EquipmentData, InventoryItem, ItemBonuses } from "@/core/domain/character/state";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";

export type EquipmentState = Pick<CharacterState, "equipment">;

const NO_BONUSES: ItemBonuses = { spellcasting: 0, armorClass: 0, savingThrows: 0 };

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

  /** База Класса Доспеха: надетый доспех или его отсутствие. */
  get armorClassBase(): number {
    return this.data.armorClassBase;
  }

  get items(): readonly InventoryItem[] {
    return this.data.items;
  }

  get otherBonuses(): ItemBonuses {
    return this.data.otherBonuses;
  }

  /**
   * Что снаряжение прибавляет к числам: непривязанные прибавки плюс надетые вещи.
   *
   * Лежащее в сумке не считается: кольцо в мешке защиты не даёт, и число, выросшее от покупки,
   * разошлось бы с тем, что действует за столом.
   */
  get bonuses(): ItemBonuses {
    return this.data.items.reduce<ItemBonuses>(
      (total, item) =>
        !item.worn || item.bonuses === undefined
          ? total
          : {
              spellcasting: total.spellcasting + item.bonuses.spellcasting,
              armorClass: total.armorClass + item.bonuses.armorClass,
              savingThrows: total.savingThrows + item.bonuses.savingThrows,
            },
      { ...this.data.otherBonuses },
    );
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

  withArmorClassBase(armorClassBase: number): Equipment {
    if (!Number.isInteger(armorClassBase) || armorClassBase <= 0) {
      throw new DomainError(
        `База Класса Доспеха должна быть целым положительным, получено: ${armorClassBase}`,
      );
    }
    return this.with({ armorClassBase });
  }

  withOtherBonuses(otherBonuses: ItemBonuses): Equipment {
    return this.with({ otherBonuses });
  }

  /**
   * Новая вещь идёт в конец: порядок ввода — единственный, который игрок помнит.
   *
   * Одноимённая складывается в количество, а не отвергается: второе зелье лечения — самая частая
   * находка за столом, и отказ на ней означал бы, что запас пополняют удалением и вводом заново.
   */
  addItem(item: InventoryItem): Equipment {
    const found = this.data.items.find((existing) => existing.id === item.id);
    if (found !== undefined) {
      return this.replaceItem({ ...found, count: found.count + item.count });
    }
    return this.with({ items: [...this.data.items, item] });
  }

  replaceItem(item: InventoryItem): Equipment {
    if (!this.data.items.some((existing) => existing.id === item.id)) {
      throw new DomainError(`Вещи «${item.id}» нет в инвентаре`);
    }
    return this.with({
      items: this.data.items.map((existing) => (existing.id === item.id ? item : existing)),
    });
  }

  removeItem(id: string): Equipment {
    const items = this.data.items.filter((item) => item.id !== id);
    if (items.length === this.data.items.length) {
      throw new DomainError(`Вещи «${id}» нет в инвентаре`);
    }
    return this.with({ items });
  }

  toggleWorn(id: string): Equipment {
    const found = this.data.items.find((item) => item.id === id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет в инвентаре`);
    return this.replaceItem({ ...found, worn: !found.worn });
  }

  /** Списывает один экземпляр; последний уходит из сумки вместе с вещью. */
  spendItem(id: string): Equipment {
    const found = this.data.items.find((item) => item.id === id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет в инвентаре`);
    return found.count === 1 ? this.removeItem(id) : this.replaceItem({ ...found, count: found.count - 1 });
  }

  toState(): EquipmentState {
    return this.state;
  }
}

export { NO_BONUSES };
