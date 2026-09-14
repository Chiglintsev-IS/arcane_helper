import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { undoLast, type Occasion, type Session } from "@/core/application/session";
import { createWizard, withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import { addItem, adjustBagCount } from "./equipment";
import {
  batchSpending,
  craftBatch,
  mixtureKinds,
  noteIngredientReference,
  recordRecipe,
} from "./crafting";

function testOccasion(commandId = "command-1"): Occasion {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 16, 9, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
    commandId,
  };
}

const occasion = testOccasion();

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";

/** Виды состава называются вещами: формула ссылается на них так же, как сумка. */
const MOON_HERB_ID = Items.idFromName(MOON_HERB);
const CRIMSON_ROOT_ID = Items.idFromName(CRIMSON_ROOT);
const HEALING = { number: 1, nameRu: "Лечение здоровья" } as const;

const STANDARD: RecipeFormula = {
  kinds: [MOON_HERB_ID, CRIMSON_ROOT_ID],
  mainProperty: HEALING.nameRu,
  mainRarity: "Обычное",
  purified: false,
  duration: null,
  onset: "Немедленно",
  fullRepeats: 0,
  reach: "Одна цель, предмет или участок",
  application: "Выпить, накормить или нанести на неподвижную цель",
  resistance: "Положительное воздействие на добровольную цель",
  suppressed: [],
  limitations: [],
};

function bagCount(session: Session, nameRu: string): number {
  return Character.of(session.character).equipment.bagCount(Items.idFromName(nameRu));
}

function stocked(portionsEach: number): Session {
  const known = [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING]),
    createWizard(),
  );
  return [MOON_HERB, CRIMSON_ROOT].reduce<Session>(
    (session, kind) =>
      adjustBagCount(
        addItem(session, { nameRu: kind, kinds: ["ingredient"] }, occasion),
        Items.idFromName(kind),
        portionsEach - 1,
        occasion,
      ),
    { character: known, log: [] },
  );
}

describe("виды состава", () => {
  it("вид, которого нет среди вещей или который не ингредиент, отвергается с причиной", () => {
    const root = Character.of(createWizard());

    expect(() => mixtureKinds(root.items, ["нет-такого"])).toThrow(/нет среди заведённых вещей/);
    expect(() => mixtureKinds(root.items, ["robe"])).toThrow(/нет среди заведённых вещей/);
  });
});

describe("изготовление состава", () => {
  it("закладка партии списывает все виды одной записью лога", () => {
    const before = stocked(6);
    const entriesBefore = before.log.length;

    const crafted = craftBatch(before, { formula: STANDARD, portions: 4 }, occasion);

    expect(bagCount(crafted, MOON_HERB)).toBe(2);
    expect(bagCount(crafted, CRIMSON_ROOT)).toBe(2);
    expect(crafted.log).toHaveLength(entriesBefore + 1);
    expect(crafted.log.at(-1)?.summaryRu).toBe(
      "Заложено: Лечение здоровья, сложность 10, 5 единиц. Истрачено по 4 порции: Лунная трава, Багровый корень",
    );

    const undone = undoLast(crafted);
    expect(bagCount(undone, MOON_HERB)).toBe(6);
    expect(bagCount(undone, CRIMSON_ROOT)).toBe(6);
  });

  it("нехватка одного вида отменяет всю работу, и второй вид остаётся нетронутым", () => {
    const scarce = adjustBagCount(stocked(2), Items.idFromName(CRIMSON_ROOT), -1, occasion);

    expect(() => craftBatch(scarce, { formula: STANDARD, portions: 2 }, occasion)).toThrow(
      /столько не потратить/,
    );
    expect(bagCount(scarce, MOON_HERB)).toBe(2);
  });

  it("сверх предела набора не работают, пока мастер не разрешил, — и тогда ничего не тратят", () => {
    const stock = stocked(6);
    const hard = { ...STANDARD, duration: "24 часа" } as const;

    expect(() => craftBatch(stock, { formula: hard, portions: 1 }, occasion)).toThrow(
      /Сложность 22 выше предела набора \(20\)/,
    );
    expect(bagCount(stock, MOON_HERB)).toBe(6);

    const allowed = craftBatch(stock, { formula: hard, portions: 1, allowAnyway: true }, occasion);
    expect(bagCount(allowed, MOON_HERB)).toBe(5);
  });

  it("расход партии называет и нужное, и то, чего недостаёт", () => {
    const root = Character.of(stocked(2).character);
    const kinds = mixtureKinds(root.items, STANDARD.kinds);

    expect(batchSpending(root, kinds, 3)).toEqual([
      { itemId: MOON_HERB_ID, nameRu: MOON_HERB, portions: 3, inBagPortions: 2, shortPortions: 1 },
      {
        itemId: CRIMSON_ROOT_ID,
        nameRu: CRIMSON_ROOT,
        portions: 3,
        inBagPortions: 2,
        shortPortions: 1,
      },
    ]);
  });
});

describe("записанный рецепт", () => {
  it("рецепт записывает игрок, и запись называет замысел и его цену", () => {
    const recorded = recordRecipe(stocked(6), STANDARD, occasion);

    expect(recorded.log.at(-1)?.summaryRu).toBe("Записан рецепт: Лечение здоровья, сложность 10");
    expect(Character.of(recorded.character).crafting.knows(STANDARD)).toBe(true);
  });

  it("порядок видов формулы не меняет: записанное узнаётся и наоборот", () => {
    const recorded = recordRecipe(stocked(6), STANDARD, occasion);
    const reordered = { ...STANDARD, kinds: [CRIMSON_ROOT_ID, MOON_HERB_ID] };

    expect(Character.of(recorded.character).crafting.knows(reordered)).toBe(true);
    expect(
      Character.of(recorded.character).crafting.knows({ ...STANDARD, duration: "1 минута" }),
    ).toBe(false);
  });
});

describe("справка о виде", () => {
  it("дописанное со слов мастера перекрывает записанное прежде", () => {
    const written = noteIngredientReference(
      stocked(2),
      { itemId: MOON_HERB_ID, reference: { findDc: 9 }, priceGold: 5 },
      occasion,
    );
    const later = noteIngredientReference(
      written,
      { itemId: MOON_HERB_ID, reference: { findDc: 12, yieldRu: "1к6 порций с заросли" } },
      occasion,
    );
    const items = Character.of(later.character).items;

    expect(items.alchemyOf(MOON_HERB_ID)).toMatchObject({
      findDc: 12,
      yieldRu: "1к6 порций с заросли",
    });
    expect(items.find(MOON_HERB_ID)?.price).toEqual({ amount: 5, currency: "gold" });
    expect(later.log.at(-1)?.summaryRu).toBe("Дописано о виде: Лунная трава");
  });

  it("сложность проверки — целое от одного, и отказ называет причину", () => {
    expect(() =>
      noteIngredientReference(stocked(2), { itemId: MOON_HERB_ID, reference: { gatherDc: 0 } }, occasion),
    ).toThrow(/справку о виде/);
  });
});
