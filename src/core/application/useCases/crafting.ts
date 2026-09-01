import { Character } from "@/core/domain/assembly/character";
import { closedRefusal } from "@/core/domain/crafting/forbidden";
import { Items } from "@/core/domain/items/items";
import type { Batch } from "@/core/domain/crafting/batch";
import { ALCHEMY_ABILITY, developmentOutcome } from "@/core/domain/crafting/development";
import type { DevelopmentOutcome } from "@/core/domain/crafting/development";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import type { MixtureKind } from "@/core/domain/crafting/crafting";
import type { AlchemicalRarity } from "@/core/domain/catalog/alchemy";
import type { RevealedProperty } from "@/core/domain/items/ingredient";
import { ingredient } from "@/core/domain/items/schema";
import { DomainError } from "@/core/domain/shared/errors";
import { withPlural } from "@/shared/language";
import { commit, withoutRecord, type Occasion, type Session } from "@/core/application/session";

type CraftOrder = {
  readonly formula: RecipeFormula;
  readonly portions: number;
  readonly rolled?: number | undefined;
  readonly mishapRolled?: number | undefined;
  readonly risky?: boolean | undefined;
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

function missingCheckRefusal(): string {
  return "Рецепт ещё не записан: назовите выпавшее на проверке разработки";
}

function unitsRu(batch: Batch): string {
  return withPlural(batch.units, ["единица", "единицы", "единиц"]);
}

function spentRu(order: CraftOrder, kinds: readonly MixtureKind[]): string {
  const portions = withPlural(order.portions, ["порции", "порции", "порций"]);
  return `Истрачено по ${portions}: ${kinds.map((kind) => kind.nameRu).join(", ")}`;
}

function craftedSummary(
  order: CraftOrder,
  batch: Batch,
  kinds: readonly MixtureKind[],
  outcome: DevelopmentOutcome | null,
): string {
  const spent = spentRu(order, kinds);
  const named = batch.difficulty.mainRu;
  if (outcome === null) return `Изготовлено: ${named}, ${unitsRu(batch)}. ${spent}`;

  const check = `Проверка ${outcome.total} против ${batch.difficulty.total}`;
  if (outcome.mishapRu !== undefined) return `Авария: ${named}. ${outcome.mishapRu} ${spent}`;
  if (!outcome.success) return `Не вышло: ${named}. ${check}. ${spent}`;

  const reward = outcome.rewarded ? " Натуральная двадцать: лишняя единица или половина расходников." : "";
  return `Изготовлено: ${named}, ${unitsRu(batch)}. ${check}.${reward} ${spent}`;
}

export function noteObservation(
  session: Session,
  itemId: string,
  textRu: string,
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return withoutRecord(
    session,
    root.withItems(root.items.noteObservation(itemId, { id: occasion.nextId(), textRu })),
  );
}

export function rewriteObservation(
  session: Session,
  itemId: string,
  id: string,
  textRu: string,
): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withItems(root.items.rewriteObservation(itemId, id, textRu)));
}

export function dropObservation(session: Session, itemId: string, id: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withItems(root.items.dropObservation(itemId, id)));
}

export function craftBatch(session: Session, order: CraftOrder, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const crafting = root.crafting;
  const kinds = mixtureKinds(root.items, order.formula.kinds);
  const batch = crafting.batchOf(kinds, order.formula, crafting.apparatus, order.portions);
  const closed = closedRefusal(batch.difficulty.directions);
  if (closed !== undefined) throw new DomainError(closed);
  if (!crafting.knows(order.formula) && order.rolled === undefined) {
    throw new DomainError(missingCheckRefusal());
  }

  const outcome =
    order.rolled === undefined
      ? null
      : developmentOutcome({
          rolled: order.rolled,
          mishapRolled: order.mishapRolled,
          check: crafting.checkFor(batch.difficulty.directions, {
            proficiencyBonus: root.sheet.value("proficiencyBonus"),
            abilityModifier: root.sheet.abilityModifier(ALCHEMY_ABILITY),
          }),
          difficulty: batch.difficulty.total,
        });

  const spent = kinds.reduce(
    (equipment, kind) => equipment.adjustBagCount(kind.id, -order.portions),
    root.equipment,
  );
  const worked = root.withEquipment(spent);

  return commit(
    session,
    outcome?.success === true
      ? worked.withCrafting(crafting.recordRecipe(order.formula, order.risky === true))
      : worked,
    { kind: "batch_crafted", summaryRu: craftedSummary(order, batch, kinds, outcome) },
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
  reveal: { itemId: string; property: RevealedProperty; rarity?: AlchemicalRarity | undefined },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const known = root.withItems(root.items.revealProperty(reveal.itemId, reveal.property));
  return commit(
    session,
    reveal.rarity === undefined
      ? known
      : known.withCrafting(known.crafting.nameRarity(reveal.property.nameRu, reveal.rarity)),
    {
      kind: "sheet_edited",
      summaryRu: `Раскрыто: ${root.items.ingredientNameRu(reveal.itemId)} — ${reveal.property.nameRu}`,
    },
    occasion,
  );
}

export function nameRarity(
  session: Session,
  named: { propertyRu: string; rarity: AlchemicalRarity },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.nameRarity(named.propertyRu, named.rarity)),
    { kind: "sheet_edited", summaryRu: `Названа редкость: ${named.propertyRu}` },
    occasion,
  );
}

export function markPropertiesExhausted(
  session: Session,
  mark: { itemId: string; exhausted: boolean },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  const named = mark.exhausted ? "У вида больше нет свойств" : "У вида могут быть ещё свойства";
  return commit(
    session,
    root.withItems(root.items.markPropertiesExhausted(mark.itemId, mark.exhausted)),
    { kind: "sheet_edited", summaryRu: `${named}: ${root.items.ingredientNameRu(mark.itemId)}` },
    occasion,
  );
}
