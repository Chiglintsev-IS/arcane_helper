/**
 * Вещи: что персонаж завёл за столом — и ничего о том, сколько их у него и где они.
 *
 * Отдельно от снаряжения намеренно: снаряжение отвечает «сколько этого у меня и что на мне», вещи —
 * «что это такое». Разводить их значило бы дать вещи знать про сумку, которой у неё нет.
 */

import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import {
  alignedItemDefinition,
  assertItemDefinition,
  withoutEmptyBonuses,
} from "./schema";
import type { ItemDefinition } from "./schema";

type ItemsState = { itemDefinitions: readonly ItemDefinition[] };

export class Items {
  private static readonly KEYS = ["itemDefinitions"] as const satisfies readonly (keyof ItemsState)[];

  private constructor(private readonly state: ItemsState) {}

  static of(state: ItemsState): Items {
    return new Items(ownedFields(state, Items.KEYS));
  }

  private get data(): readonly ItemDefinition[] {
    return this.state.itemDefinitions;
  }

  private with(itemDefinitions: readonly ItemDefinition[]): Items {
    return new Items({ itemDefinitions });
  }

  get all(): readonly ItemDefinition[] {
    return this.data;
  }

  find(id: string): ItemDefinition | undefined {
    return this.data.find((item) => item.id === id);
  }

  /**
   * id по умолчанию для новой вещи: строчными, пробелы дефисом. Одинаковое имя всегда даёт
   * одинаковый id, поэтому вторая находка того же названия сама находит свою вещь.
   */
  static idFromName(nameRu: string): string {
    return nameRu.trim().toLowerCase().replaceAll(" ", "-");
  }

  /**
   * Заводит вещь. Одноимённая той же категории уже заведена — вторую запись это не создаёт: правки
   * природы вещи ждут «Правки вещи», а не повторного заведения.
   *
   * id можно не передавать: находка по имени получает его сама, а не от экрана.
   */
  addDefinition(item: Omit<ItemDefinition, "id"> & { id?: string }): Items {
    const id = item.id ?? Items.idFromName(item.nameRu);
    const withId: ItemDefinition = { ...item, id };
    assertItemDefinition(withId);
    const found = this.find(id);
    if (found === undefined) return this.with([...this.data, withId]);
    if (found.kind !== withId.kind) {
      throw new DomainError(`«${found.nameRu}» уже заведена другой категорией`);
    }
    return this;
  }

  /** Правка вещи целиком. Поля, которых её категории не положено, снимаются, а не отвергаются. */
  replaceDefinition(item: ItemDefinition): Items {
    const stored = alignedItemDefinition(withoutEmptyBonuses(item));
    if (!this.data.some((existing) => existing.id === item.id)) {
      throw new DomainError(`Вещи «${item.id}» нет среди заведённых`);
    }
    return this.with(this.data.map((existing) => (existing.id === item.id ? stored : existing)));
  }

  removeDefinition(id: string): Items {
    const rest = this.data.filter((item) => item.id !== id);
    if (rest.length === this.data.length) {
      throw new DomainError(`Вещи «${id}» нет среди заведённых`);
    }
    return this.with(rest);
  }

  toState(): ItemsState {
    return this.state;
  }
}
