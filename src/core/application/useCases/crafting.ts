/**
 * Изготовление алхимического состава.
 *
 * Сводит три контекста, которые друг о друге не знают: ремесло отвечает, во что обходится рецепт и
 * сколько выйдет единиц, лист — какими числами алхимик бросает, снаряжение — отдаёт порции. Знание
 * о виде и запас вида связывает название: ремесло помнит, что узнано про «Лунную траву», сумка —
 * сколько её лежит.
 *
 * Расход всех видов идёт одной записью журнала: изготовление из трёх видов, записанное тремя
 * записями, отменялось бы по одному виду и возвращало бы половину рецепта.
 */

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { Batch } from "@/core/domain/crafting/batch";
import { ALCHEMY_ABILITY, developmentOutcome } from "@/core/domain/crafting/development";
import type { DevelopmentOutcome } from "@/core/domain/crafting/development";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import type { RevealedProperty } from "@/core/domain/crafting/schema";
import { DomainError } from "@/core/domain/shared/errors";
import { withPlural } from "@/shared/language";
import { commit, type Occasion, type Session } from "@/core/application/session";

/**
 * Что заложено: замысел, размер партии и то, что выпало у игрока.
 *
 * Выпавшее приходит числом, потому что кость кидает он. Незаписанному рецепту без выпавшего ходу
 * нет: справочник требует проверки разработки, и решить её за столом приложение не вправе.
 */
type CraftOrder = {
  readonly formula: RecipeFormula;
  readonly portions: number;
  readonly rolled?: number | undefined;
  readonly mishapRolled?: number | undefined;
  readonly risky?: boolean | undefined;
};

/** Виды состава по одному разу: две порции одного вида остаются одним видом. */
function distinctKinds(formula: RecipeFormula): readonly string[] {
  return [...new Set(formula.kinds)];
}

function missingCheckRefusal(): string {
  return "Рецепт ещё не записан: назовите выпавшее на проверке разработки";
}

function unitsRu(batch: Batch): string {
  return withPlural(batch.units, ["единица", "единицы", "единиц"]);
}

function spentRu(order: CraftOrder, kinds: readonly string[]): string {
  const portions = withPlural(order.portions, ["порции", "порции", "порций"]);
  return `Истрачено по ${portions}: ${kinds.join(", ")}`;
}

/**
 * Подпись записи: что вышло и чем за это заплачено.
 *
 * Провал списывает то же самое и не даёт ничего — справочник теряет на нём и ингредиенты, и
 * расходники, — поэтому и запись о нём называет истраченное: иначе сумка убыла бы молча.
 */
function craftedSummary(
  order: CraftOrder,
  batch: Batch,
  kinds: readonly string[],
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

/**
 * Изготавливает партию: списывает по порции каждого вида на каждую рецептурную порцию.
 *
 * Сначала ремесло, потом сумка: невозможная работа — сложнее предела оснащения или крупнее предела
 * партии — отказывает раньше, чем истрачена первая порция. А вот провал проверки порции всё же
 * тратит: так велит справочник, и запись о нём стоит в журнале рядом с удачей.
 */
export function craftBatch(session: Session, order: CraftOrder, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const crafting = root.crafting;
  const batch = crafting.batchOf(order.formula, crafting.apparatus, order.portions);
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

  const kinds = distinctKinds(order.formula);
  const spent = kinds.reduce(
    (equipment, kind) => equipment.adjustBagCount(Items.idFromName(kind), -order.portions),
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

/**
 * Записывает мастерскую: чем алхимик оснащён и каким направлениям обучен.
 *
 * Через журнал, как всякая правка листа: купленный модуль и выученное направление двигают пределы
 * работы, а сдвинутый предел обязан возвращаться так же, как возвращается истраченная порция.
 */
export function setWorkshop(session: Session, workshop: unknown, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.withWorkshop(workshop)),
    { kind: "sheet_edited", summaryRu: "Правка мастерской алхимика" },
    occasion,
  );
}

/** Записывает вид ингредиента: с этого и начинается всякое знание о нём. */
export function noteIngredient(session: Session, nameRu: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.noteIngredient(nameRu)),
    { kind: "sheet_edited", summaryRu: `Записан ингредиент: ${nameRu}` },
    occasion,
  );
}

/** Раскрывает свойство вида под его номером: название и редкость называет стол. */
export function revealProperty(
  session: Session,
  reveal: { nameRu: string; property: RevealedProperty },
  occasion: Occasion,
): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.revealProperty(reveal.nameRu, reveal.property)),
    {
      kind: "sheet_edited",
      summaryRu: `Раскрыто: ${reveal.nameRu} — ${reveal.property.nameRu}`,
    },
    occasion,
  );
}

/** Забывает вид целиком: записанное по ошибке иначе осталось бы навсегда. */
export function forgetIngredient(session: Session, nameRu: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withCrafting(root.crafting.forgetIngredient(nameRu)),
    { kind: "sheet_edited", summaryRu: `Забыт ингредиент: ${nameRu}` },
    occasion,
  );
}
