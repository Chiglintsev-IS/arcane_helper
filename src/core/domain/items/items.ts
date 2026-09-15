import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import {
  NO_ALCHEMY,
  unrevealedNumbers,
  withReference,
  withRevealedProperty,
  withoutProperty,
} from "./ingredient";
import type { IngredientAlchemy, IngredientReference, RevealedProperty } from "./ingredient";
import {
  alignedItemDefinition,
  ingredient,
  itemDefinitionOf,
  nameTakenRefusal,
  noteMissingRefusal,
  noteTakenRefusal,
} from "./schema";
import type { ItemDefinition, ItemDraft, ItemNote } from "./schema";

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

  addDefinition(item: Omit<ItemDraft, "id"> & { id?: string }): Items {
    const id = item.id ?? Items.idFromName(item.nameRu);
    const withId = itemDefinitionOf({ ...item, id });
    const found = this.find(id);
    if (found === undefined) return this.with([...this.data, withId]);

    const added = withId.kinds.filter((kind) => !found.kinds.includes(kind));
    if (added.length === 0) return this;
    return this.replaceDefinition({ ...found, kinds: [...found.kinds, ...added] });
  }

  /**
   * Правка заменяет объявленное: название, признаки, цену, прибавки, фокусировку. Алхимию и заметки
   * правка не называет, и потому не теряет — их ведут свои операции, а алхимию снимает только
   * утрата признака ингредиента.
   */
  replaceDefinition(item: ItemDraft): Items {
    const found = this.located(item.id);
    const kept = found.alchemy;
    const named = { ...item, notes: found.notes };
    const stored = alignedItemDefinition(
      named.alchemy === undefined && kept !== undefined ? { ...named, alchemy: kept } : named,
    );
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

  dropProperty(id: string, number: number): Items {
    const found = this.locatedIngredient(id);
    return this.replacingAlchemy(id, withoutProperty(found.nameRu, this.alchemyOf(id), number));
  }

  unrevealedNumbers(id: string): readonly number[] {
    return unrevealedNumbers(this.alchemyOf(id));
  }

  noteReference(id: string, reference: IngredientReference): Items {
    return this.replacingAlchemy(id, withReference(this.alchemyOf(id), reference));
  }

  setPrice(id: string, price: ItemDefinition["price"]): Items {
    return this.replaceDefinition({ ...this.located(id), price });
  }

  private located(id: string): ItemDefinition {
    const found = this.find(id);
    if (found === undefined) throw new DomainError(`Вещи «${id}» нет среди заведённых`);
    return found;
  }

  private replacingNotes(item: ItemDefinition, notes: readonly ItemNote[]): Items {
    return this.with(
      this.data.map((existing) => (existing.id === item.id ? { ...existing, notes } : existing)),
    );
  }

  addNote(id: string, note: ItemNote): Items {
    const found = this.located(id);
    if (found.notes.some((written) => written.id === note.id)) {
      throw new DomainError(noteTakenRefusal(note.id));
    }
    return this.replacingNotes(found, [...found.notes, note]);
  }

  rewriteNote(id: string, noteId: string, textRu: string): Items {
    const found = this.locatedNote(id, noteId);
    return this.replacingNotes(
      found,
      found.notes.map((written) => (written.id === noteId ? { ...written, textRu } : written)),
    );
  }

  dropNote(id: string, noteId: string): Items {
    const found = this.locatedNote(id, noteId);
    return this.replacingNotes(
      found,
      found.notes.filter((written) => written.id !== noteId),
    );
  }

  private locatedNote(id: string, noteId: string): ItemDefinition {
    const found = this.located(id);
    if (!found.notes.some((written) => written.id === noteId)) {
      throw new DomainError(noteMissingRefusal(found.nameRu, noteId));
    }
    return found;
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
