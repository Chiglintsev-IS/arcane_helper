import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import {
  NO_ALCHEMY,
  withObservation,
  withRevealedProperty,
  withRewrittenObservation,
  withoutObservation,
} from "./ingredient";
import type { IngredientAlchemy, Observation, RevealedProperty } from "./ingredient";
import { alignedItemDefinition, assertItemDefinition, ingredient, nameTakenRefusal } from "./schema";
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
    const sameName = Items.idFromName(stored.nameRu);
    if (
      this.data.some(
        (existing) =>
          existing.id !== item.id && Items.idFromName(existing.nameRu) === sameName,
      )
    ) {
      throw new DomainError(nameTakenRefusal(stored.nameRu));
    }
    return this.with(this.data.map((existing) => (existing.id === item.id ? stored : existing)));
  }

  get ingredients(): readonly ItemDefinition[] {
    return this.data.filter((item) => ingredient(item));
  }

  private locatedIngredient(id: string): ItemDefinition {
    const found = this.find(id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет среди заведённых`);
    if (!ingredient(found)) {
      throw new DomainError(`«${found.nameRu}» не ингредиент: алхимии у неё не спрашивают`);
    }
    return found;
  }

  ingredientNameRu(id: string): string {
    return this.locatedIngredient(id).nameRu;
  }

  alchemyOf(id: string): IngredientAlchemy {
    return this.locatedIngredient(id).alchemy ?? NO_ALCHEMY;
  }

  private replacingAlchemy(id: string, alchemy: IngredientAlchemy): Items {
    return this.replaceDefinition({ ...this.locatedIngredient(id), alchemy });
  }

  revealProperty(id: string, property: RevealedProperty): Items {
    return this.replacingAlchemy(id, withRevealedProperty(this.alchemyOf(id), property));
  }

  markPropertiesExhausted(id: string, propertiesExhausted: boolean): Items {
    return this.replacingAlchemy(id, { ...this.alchemyOf(id), propertiesExhausted });
  }

  noteObservation(id: string, observation: Observation): Items {
    return this.replacingAlchemy(id, withObservation(this.alchemyOf(id), observation));
  }

  rewriteObservation(id: string, observationId: string, textRu: string): Items {
    const found = this.locatedIngredient(id);
    return this.replacingAlchemy(
      id,
      withRewrittenObservation(found.nameRu, this.alchemyOf(id), observationId, textRu),
    );
  }

  dropObservation(id: string, observationId: string): Items {
    const found = this.locatedIngredient(id);
    return this.replacingAlchemy(
      id,
      withoutObservation(found.nameRu, this.alchemyOf(id), observationId),
    );
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
