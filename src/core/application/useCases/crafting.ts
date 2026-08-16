/**
 * Изготовление алхимического состава.
 *
 * Сводит два контекста, которые друг о друге не знают: ремесло отвечает, во что обходится рецепт и
 * сколько выйдет единиц, снаряжение — отдаёт порции. Знание о виде и запас вида связывает название:
 * ремесло помнит, что узнано про «Лунную траву», сумка — сколько её лежит.
 *
 * Расход всех видов идёт одной записью журнала: изготовление из трёх видов, записанное тремя
 * записями, отменялось бы по одному виду и возвращало бы половину рецепта.
 */

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { Batch } from "@/core/domain/crafting/batch";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { withPlural } from "@/shared/language";
import { commit, type Occasion, type Session } from "@/core/application/session";

/** Что заложено: замысел состава и сколько рецептурных порций закладывают. */
type CraftOrder = { readonly formula: RecipeFormula; readonly portions: number };

/** Виды состава по одному разу: две порции одного вида остаются одним видом. */
function distinctKinds(formula: RecipeFormula): readonly string[] {
  return [...new Set(formula.kinds)];
}

/**
 * Подпись записи: что вышло и чем за это заплачено.
 *
 * Названы и единицы, и порции каждого вида: единицы — то, что игрок положит в сумку, порции — то,
 * что из неё ушло, и одно по другому не восстанавливается.
 */
function craftedSummary(order: CraftOrder, batch: Batch, kinds: readonly string[]): string {
  const units = withPlural(batch.units, ["единица", "единицы", "единиц"]);
  const portions = withPlural(order.portions, ["порции", "порции", "порций"]);
  return `Изготовлено: ${order.formula.mainProperty}, ${units}. Истрачено по ${portions}: ${kinds.join(", ")}`;
}

/**
 * Изготавливает партию: списывает по порции каждого вида на каждую рецептурную порцию.
 *
 * Сначала ремесло, потом сумка: невозможная работа — сложнее предела оснащения или крупнее предела
 * партии — отказывает раньше, чем истрачена первая порция.
 */
export function craftBatch(session: Session, order: CraftOrder, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const batch = root.crafting.batchOf(order.formula, root.crafting.apparatus, order.portions);
  const kinds = distinctKinds(order.formula);
  const spent = kinds.reduce(
    (equipment, kind) => equipment.adjustBagCount(Items.idFromName(kind), -order.portions),
    root.equipment,
  );

  return commit(
    session,
    root.withEquipment(spent),
    { kind: "batch_crafted", summaryRu: craftedSummary(order, batch, kinds) },
    occasion,
  );
}
