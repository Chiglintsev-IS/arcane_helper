import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import type { MixtureKind } from "@/core/domain/crafting/crafting";
import type { IngredientReference, RevealedProperty } from "@/core/domain/items/ingredient";
import { ingredient, type ItemDefinition } from "@/core/domain/items/schema";
import { DomainError } from "@/core/domain/shared/errors";
import { commit, type Occasion, type Session } from "@/core/application/session";

function unknownKindRefusal(itemId: string): string {
  return `Ингредиента «${itemId}» нет среди заведённых вещей`;
}

/** Виды состава приходят к ремеслу вещами: свойства принадлежат им, а не отдельной записи. */
export function mixtureKinds(items: Items, kinds: readonly string[]): readonly MixtureKind[] {
  return [...new Set(kinds)].map((itemId) => {
    const found = items.find(itemId);
    if (found === undefined || !ingredient(found)) throw new DomainError(unknownKindRefusal(itemId));
    const alchemy = items.alchemyOf(itemId);
    return {
      id: found.id,
      nameRu: found.nameRu,
      properties: alchemy.properties,
      solo: alchemy.solo,
    };
  });
}

export type BatchSpending = {
  readonly itemId: string;
  readonly nameRu: string;
  readonly portions: number;
  readonly inBagPortions: number;
  readonly shortPortions: number;
};

/** Чего партия стоит запасу: сколько порций берётся у каждого вида и скольких недостаёт. */
export function batchSpending(
  root: Character,
  kinds: readonly MixtureKind[],
  portions: number,
): readonly BatchSpending[] {
  const each = root.crafting.portionsEach(kinds) * portions;
  return kinds.map((kind) => {
    const inBagPortions = root.equipment.bagCount(kind.id);
    return {
      itemId: kind.id,
      nameRu: kind.nameRu,
      portions: each,
      inBagPortions,
      shortPortions: Math.max(each - inBagPortions, 0),
    };
  });
}

/** Рецепт записывает игрок, когда стол подтвердил успех: исход приложению неоткуда узнать. */
export function recordRecipe(session: Session, formula: RecipeFormula, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const crafting = root.crafting;
  const kinds = mixtureKinds(root.items, formula.kinds);
  const cost = crafting.costOf(kinds, formula);

  return commit(
    session,
    root.withCrafting(crafting.recordRecipe(formula)),
    { kind: "sheet_edited", summaryRu: `Записан рецепт: ${cost.mainRu}, сложность ${cost.total}` },
    occasion,
  );
}

export function setWorkshop(session: Session, workshop: unknown, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.withWorkshop(workshop)),
    { kind: "sheet_edited", summaryRu: "Правка мастерской алхимика" },
    occasion,
  );
}

export function noteIngredient(session: Session, nameRu: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withItems(root.items.addDefinition({ nameRu, kinds: [] }).startAlchemy(Items.idFromName(nameRu))),
    { kind: "sheet_edited", summaryRu: `Записан ингредиент: ${nameRu}` },
    occasion,
  );
}

export function dropIngredient(session: Session, itemId: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const nameRu = root.items.ingredientNameRu(itemId);
  return commit(
    session,
    root.withItems(root.items.dropAlchemy(itemId)),
    { kind: "sheet_edited", summaryRu: `Убрана запись из алхимии: ${nameRu}` },
    occasion,
  );
}

export function revealProperty(
  session: Session,
  reveal: { itemId: string; property: RevealedProperty },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withItems(root.items.revealProperty(reveal.itemId, reveal.property)),
    {
      kind: "sheet_edited",
      summaryRu: `Раскрыто: ${root.items.ingredientNameRu(reveal.itemId)} — ${reveal.property.nameRu}`,
    },
    occasion,
  );
}

/** Правка раскрытого — своя запись в логе: уточнение слов стола работой исследования не было. */
export function rewriteProperty(
  session: Session,
  rewritten: { itemId: string; property: RevealedProperty },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withItems(root.items.rewriteProperty(rewritten.itemId, rewritten.property)),
    {
      kind: "sheet_edited",
      summaryRu: `Переписано раскрытое: ${root.items.ingredientNameRu(rewritten.itemId)} — ${rewritten.property.nameRu}`,
    },
    occasion,
  );
}

export function dropProperty(
  session: Session,
  dropped: { itemId: string; number: number },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const nameRu = root.items.ingredientNameRu(dropped.itemId);
  return commit(
    session,
    root.withItems(root.items.dropProperty(dropped.itemId, dropped.number)),
    { kind: "sheet_edited", summaryRu: `Убрано раскрытое: ${nameRu}, номер ${dropped.number}` },
    occasion,
  );
}

/**
 * Справку о виде дописывают по одному полю со слов мастера, и цена порции — такое же его поле: за
 * столом её называют вместе с прочим, а хранит её сама вещь.
 */
export function noteIngredientReference(
  session: Session,
  written: {
    itemId: string;
    reference: IngredientReference;
    price?: ItemDefinition["price"] | undefined;
  },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const nameRu = root.items.ingredientNameRu(written.itemId);
  const noted = root.items.noteReference(written.itemId, written.reference);
  const priced =
    written.price === undefined ? noted : noted.setPrice(written.itemId, written.price);

  return commit(
    session,
    root.withItems(priced),
    { kind: "sheet_edited", summaryRu: `Дописано о виде: ${nameRu}` },
    occasion,
  );
}

