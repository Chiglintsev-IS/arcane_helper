import { Character } from "@/core/domain/assembly/character";
import type { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import type { Batch } from "@/core/domain/crafting/batch";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import type { MixtureKind } from "@/core/domain/crafting/crafting";
import type { IngredientReference, RevealedProperty } from "@/core/domain/items/ingredient";
import { ingredient } from "@/core/domain/items/schema";
import { DomainError } from "@/core/domain/shared/errors";
import { GOLD } from "@/core/domain/shared/schema";
import { withPlural } from "@/shared/language";
import { commit, type Occasion, type Session } from "@/core/application/session";

type CraftOrder = {
  readonly formula: RecipeFormula;
  readonly portions: number;
  readonly allowAnyway?: boolean | undefined;
};

function unknownKindRefusal(itemId: string): string {
  return `Ингредиента «${itemId}» нет среди заведённых вещей`;
}

/** Виды состава приходят к ремеслу вещами: свойства принадлежат им, а не отдельной записи. */
export function mixtureKinds(items: Items, kinds: readonly string[]): readonly MixtureKind[] {
  return [...new Set(kinds)].map((itemId) => {
    const found = items.find(itemId);
    if (found === undefined || !ingredient(found)) throw new DomainError(unknownKindRefusal(itemId));
    return { id: found.id, nameRu: found.nameRu, properties: items.alchemyOf(itemId).properties };
  });
}

/**
 * Одна трата на все виды: партия списывает по порции каждого, а сколько в порции штук, знает сам
 * вид. Спросивший цену и заложивший партию идут этим же путём — вторая такая же трата разошлась бы
 * с настоящей при первой правке меры.
 */
function spentOnBatch(
  root: Character,
  kinds: readonly MixtureKind[],
  portions: number,
): Equipment {
  return kinds.reduce(
    (equipment, kind) =>
      equipment.adjustBagCount(kind.id, -root.items.piecesForPortions(kind.id, portions)),
    root.equipment,
  );
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
  return kinds.map((kind) => {
    const inBagPortions = root.items.portionsFromPieces(kind.id, root.equipment.bagCount(kind.id));
    return {
      itemId: kind.id,
      nameRu: kind.nameRu,
      portions,
      inBagPortions,
      shortPortions: Math.max(portions - inBagPortions, 0),
    };
  });
}

function unitsRu(batch: Batch): string {
  return withPlural(batch.units, ["единица", "единицы", "единиц"]);
}

function spentRu(order: CraftOrder, kinds: readonly MixtureKind[]): string {
  const portions = withPlural(order.portions, ["порции", "порции", "порций"]);
  return `Истрачено по ${portions}: ${kinds.map((kind) => kind.nameRu).join(", ")}`;
}

function craftedSummary(order: CraftOrder, batch: Batch, kinds: readonly MixtureKind[]): string {
  const named = batch.difficulty.mainRu;
  const check = `сложность ${batch.difficulty.total}`;
  return `Заложено: ${named}, ${check}, ${unitsRu(batch)}. ${spentRu(order, kinds)}`;
}

/**
 * Партия закладывается, а бросок и исход остаются за столом: приложение считает цену замысла и
 * списывает порции. Предел набора оно называет предупреждением — снять его вправе только мастер.
 */
export function craftBatch(session: Session, order: CraftOrder, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const crafting = root.crafting;
  const kinds = mixtureKinds(root.items, order.formula.kinds);
  const batch = crafting.batchOf(kinds, order.formula, crafting.apparatus, order.portions);
  const warning = batch.warnings[0];
  if (warning !== undefined && order.allowAnyway !== true) throw new DomainError(warning.reasonRu);

  return commit(
    session,
    root.withEquipment(spentOnBatch(root, kinds, order.portions)),
    { kind: "batch_crafted", summaryRu: craftedSummary(order, batch, kinds) },
    occasion,
  );
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
    root.withItems(root.items.addDefinition({ nameRu, kinds: ["ingredient"] })),
    { kind: "sheet_edited", summaryRu: `Записан ингредиент: ${nameRu}` },
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
  written: { itemId: string; reference: IngredientReference; priceGold?: number | undefined },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const nameRu = root.items.ingredientNameRu(written.itemId);
  const noted = root.items.noteReference(written.itemId, written.reference);
  const priced =
    written.priceGold === undefined
      ? noted
      : noted.setPrice(written.itemId, { amount: written.priceGold, currency: GOLD });

  return commit(
    session,
    root.withItems(priced),
    { kind: "sheet_edited", summaryRu: `Дописано о виде: ${nameRu}` },
    occasion,
  );
}

export function setPortionSize(
  session: Session,
  portion: { itemId: string; pieces: number },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const nameRu = root.items.ingredientNameRu(portion.itemId);
  return commit(
    session,
    root.withItems(root.items.setPortionSize(portion.itemId, portion.pieces)),
    { kind: "sheet_edited", summaryRu: `Штук в порции: ${nameRu} — ${portion.pieces}` },
    occasion,
  );
}
