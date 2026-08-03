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

import type { CharacterState, Equipment as EquipmentData, InventoryItem, ItemBonuses, Money } from "@/core/domain/character/state";
import { MAXIMUM_ITEM_COUNT } from "@/core/domain/character/state";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";

export type EquipmentState = Pick<CharacterState, "equipment">;

/** База Класса Доспеха без доспехов — правило игры, а не настройка. */
export const UNARMORED_ARMOR_CLASS_BASE = 10;

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

  /**
   * Надетый доспех, задающий базу КД: из надетой экипировки с базой берётся наибольшая.
   *
   * Замены базы не складываются — то же правило, что у «Доспехов мага» против кольчуги: вторая
   * кираса поверх первой защищает не лучше.
   */
  get wornArmor(): InventoryItem | undefined {
    return this.data.items.reduce<InventoryItem | undefined>(
      (best, item) =>
        item.kind === "gear" &&
        item.worn &&
        item.armorBase !== undefined &&
        item.armorBase > (best?.armorBase ?? 0)
          ? item
          : best,
      undefined,
    );
  }

  /** База Класса Доспеха — производная от надетого: доспех или его отсутствие. */
  get armorClassBase(): number {
    return this.wornArmor?.armorBase ?? UNARMORED_ARMOR_CLASS_BASE;
  }

  get items(): readonly InventoryItem[] {
    return this.data.items;
  }

  get money(): Money {
    return this.data.money;
  }

  /**
   * Что снаряжение прибавляет к числам: надетые вещи, и только они.
   *
   * Лежащее в сумке не считается: кольцо в мешке защиты не даёт, и число, выросшее от покупки,
   * разошлось бы с тем, что действует за столом. Прибавка без вещи — свойство персонажа, а не
   * снаряжения, и живёт у него.
   */
  get bonuses(): ItemBonuses {
    return this.data.items.reduce<ItemBonuses>(
      (total, item) =>
        item.kind !== "gear" || !item.worn || item.bonuses === undefined
          ? total
          : {
              spellcasting: total.spellcasting + item.bonuses.spellcasting,
              armorClass: total.armorClass + item.bonuses.armorClass,
              savingThrows: total.savingThrows + item.bonuses.savingThrows,
            },
      { ...NO_BONUSES },
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

  /**
   * Новая вещь идёт в конец: порядок ввода — единственный, который игрок помнит.
   *
   * Одноимённая той же категории складывается в запас, а не отвергается: второе зелье лечения —
   * самая частая находка за столом. Одноимённая другой категории отвергается с причиной: молча
   * пополнить чужой раздел значит спрятать находку от игрока, который печатал её в свой.
   */
  addItem(item: InventoryItem): Equipment {
    const found = this.data.items.find((existing) => existing.id === item.id);
    if (found === undefined) {
      return this.with({ items: [...this.data.items, item] });
    }
    if (found.kind !== item.kind) {
      throw new DomainError(`«${found.nameRu}» уже лежит в сумке другой категорией`);
    }
    // Пополнение идёт тем же приращением, что и кнопка «+»: предел запаса один на оба входа.
    return item.count === 0 ? this : this.adjustCount(item.id, item.count);
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

  /** Надевается только экипировка: «надетое зелье» не участвует ни в одном правиле. */
  toggleWorn(id: string): Equipment {
    const found = this.data.items.find((item) => item.id === id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет в инвентаре`);
    if (found.kind !== "gear") {
      throw new DomainError(`«${found.nameRu}» не экипировка и не надевается`);
    }
    return this.replaceItem({ ...found, worn: !found.worn });
  }

  /**
   * Меняет запас вещи на приращение — расход или пополнение.
   *
   * Ноль — состояние, а не отсутствие: кончившееся зелье остаётся строкой с нулём, чтобы было
   * видно, что оно кончилось, а не забыто. Убирается вещь только явным удалением.
   */
  adjustCount(id: string, delta: number): Equipment {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new DomainError(`Приращение запаса должно быть целым и ненулевым, получено: ${delta}`);
    }
    const found = this.data.items.find((item) => item.id === id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет в инвентаре`);
    const count = found.count + delta;
    if (count < 0) {
      throw new DomainError(`«${found.nameRu}»: осталось ${found.count}, столько не потратить`);
    }
    if (count > MAXIMUM_ITEM_COUNT) {
      throw new DomainError(`«${found.nameRu}»: больше ${MAXIMUM_ITEM_COUNT} не хранится`);
    }
    return this.replaceItem({ ...found, count });
  }

  withMoney(money: Money): Equipment {
    return this.with({ money });
  }

  toState(): EquipmentState {
    return this.state;
  }
}

export { NO_BONUSES };
