import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { undoLast, type Occasion, type Session } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import { addItem, adjustBagCount } from "./equipment";
import { craftBatch } from "./crafting";

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
const HEALING = { number: 1, nameRu: "Лечение здоровья", rarity: "common" } as const;

const STANDARD: RecipeFormula = {
  kinds: [MOON_HERB, CRIMSON_ROOT],
  mainProperty: HEALING.nameRu,
  duration: null,
  onset: "Немедленно",
  fullRepeats: 0,
  reach: "Одна цель, предмет или участок",
  application: "Выпить, накормить или нанести на неподвижную цель",
  resistance: "Положительное воздействие на добровольную цель",
  purification: null,
  suppressed: [],
  limitations: [],
};

function bagCount(session: Session, nameRu: string): number {
  return Character.of(session.character).equipment.bagCount(Items.idFromName(nameRu));
}

/** Торн, у которого оба вида записаны знанием и лежат в сумке названным числом порций. */
function stocked(portionsEach: number): Session {
  const known = [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING]),
    createThorne(),
  );
  return [MOON_HERB, CRIMSON_ROOT].reduce<Session>(
    (session, kind) =>
      adjustBagCount(
        addItem(session, { nameRu: kind, kind: "ingredient" }, occasion),
        Items.idFromName(kind),
        portionsEach - 1,
        occasion,
      ),
    { character: known, journal: [] },
  );
}

describe("изготовление состава", () => {
  it("изготовление списывает все виды одной записью журнала", () => {
    const before = stocked(6);
    const entriesBefore = before.journal.length;

    const crafted = craftBatch(before, { formula: STANDARD, portions: 4 }, occasion);

    expect(bagCount(crafted, MOON_HERB)).toBe(2);
    expect(bagCount(crafted, CRIMSON_ROOT)).toBe(2);
    expect(crafted.journal).toHaveLength(entriesBefore + 1);
    expect(crafted.journal.at(-1)?.summaryRu).toBe(
      "Изготовлено: Лечение здоровья, 5 единиц. Истрачено по 4 порции: Лунная трава, Багровый корень",
    );

    // Одна запись — одна отмена: возвращаются оба вида разом, а не половина рецепта.
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

  it("работа сверх предела записанного оснащения не тратит ничего и называет лишнее", () => {
    const stock = stocked(6);

    expect(() =>
      craftBatch(stock, { formula: { ...STANDARD, duration: "24 часа" }, portions: 1 }, occasion),
    ).toThrow(/Сложность 22 выше предела оснащения 20\. Набрано: Длительность \+12/);
    expect(bagCount(stock, MOON_HERB)).toBe(6);
  });
});
