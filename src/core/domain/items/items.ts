import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { alignedItemDefinition, assertItemDefinition } from "./schema";
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

  static idFromName(nameRu: string): string {
    return nameRu.trim().toLowerCase().replaceAll(" ", "-");
  }

  addDefinition(item: Omit<ItemDefinition, "id"> & { id?: string }): Items {
    const id = item.id ?? Items.idFromName(item.nameRu);
    const withId: ItemDefinition = { ...item, id };
    assertItemDefinition(withId);
    const found = this.find(id);
    if (found === undefined) return this.with([...this.data, withId]);

    const added = withId.kinds.filter((kind) => !found.kinds.includes(kind));
    if (added.length === 0) return this;
    return this.replaceDefinition({ ...found, kinds: [...found.kinds, ...added] });
  }

  replaceDefinition(item: ItemDefinition): Items {
    const stored = alignedItemDefinition(item);
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
