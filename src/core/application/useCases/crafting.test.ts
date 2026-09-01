import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { undoLast, type Occasion, type Session } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import { addItem, adjustBagCount } from "./equipment";
import {
  craftBatch,
  markPropertiesExhausted,
  mixtureKinds,
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
const HEALING = { number: 1, nameRu: "Лечение здоровья", rarity: "common" } as const;

const STANDARD: RecipeFormula = {
  kinds: [MOON_HERB_ID, CRIMSON_ROOT_ID],
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

function exhaustedOf(session: Session, nameRu: string): boolean {
  const root = Character.of(session.character);
  return root.items.alchemyOf(Items.idFromName(nameRu)).propertiesExhausted;
}

function stocked(portionsEach: number): Session {
  const known = [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING]),
    createThorne(),
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

const POISON = { number: 2, nameRu: "Ядовитый урон", rarity: "rare" } as const;

const HYBRID: RecipeFormula = { ...STANDARD };

function poisonous(): Session {
  const known = [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING, POISON]),
    createThorne(),
  );
  return [MOON_HERB, CRIMSON_ROOT].reduce<Session>(
    (session, kind) =>
      adjustBagCount(
        addItem(session, { nameRu: kind, kinds: ["ingredient"] }, occasion),
        Items.idFromName(kind),
        5,
        occasion,
      ),
    { character: known, log: [] },
  );
}

describe("виды состава", () => {
  it("вид, которого нет среди вещей или который не ингредиент, отвергается с причиной", () => {
    const root = Character.of(createThorne());

    expect(() => mixtureKinds(root.items, ["нет-такого"])).toThrow(/нет среди заведённых вещей/);
    expect(() => mixtureKinds(root.items, ["robe"])).toThrow(/нет среди заведённых вещей/);
  });
});

describe("изготовление состава", () => {
  it("изготовление списывает все виды одной записью лога", () => {
    const before = stocked(6);
    const entriesBefore = before.log.length;

    const crafted = craftBatch(before, { formula: STANDARD, portions: 4, rolled: 15 }, occasion);

    expect(bagCount(crafted, MOON_HERB)).toBe(2);
    expect(bagCount(crafted, CRIMSON_ROOT)).toBe(2);
    expect(crafted.log).toHaveLength(entriesBefore + 1);
    expect(crafted.log.at(-1)?.summaryRu).toBe(
      "Изготовлено: Лечение здоровья, 5 единиц. Проверка 22 против 10. Истрачено по 4 порции: Лунная трава, Багровый корень",
    );

    const undone = undoLast(crafted);
    expect(bagCount(undone, MOON_HERB)).toBe(6);
    expect(bagCount(undone, CRIMSON_ROOT)).toBe(6);
  });

  it("нехватка одного вида отменяет всю работу, и второй вид остаётся нетронутым", () => {
    const scarce = adjustBagCount(stocked(2), Items.idFromName(CRIMSON_ROOT), -1, occasion);

    expect(() =>
      craftBatch(scarce, { formula: STANDARD, portions: 2, rolled: 15 }, occasion),
    ).toThrow(
      /столько не потратить/,
    );
    expect(bagCount(scarce, MOON_HERB)).toBe(2);
  });

  it("работа сверх предела записанного оснащения не тратит ничего и называет лишнее", () => {
    const stock = stocked(6);

    expect(() =>
      craftBatch(
        stock,
        { formula: { ...STANDARD, duration: "24 часа" }, portions: 1, rolled: 15 },
        occasion,
      ),
    ).toThrow(/Сложность 22 выше предела оснащения 20\. Набрано: Длительность \+12/);
    expect(bagCount(stock, MOON_HERB)).toBe(6);
  });
});

describe("проверка разработки", () => {
  it("известный рецепт повторяется без броска, пока совпадают все четыре условия", () => {
    const first = stocked(6);
    expect(() => craftBatch(first, { formula: STANDARD, portions: 1 }, occasion)).toThrow(
      /назовите выпавшее/,
    );

    const developed = craftBatch(first, { formula: STANDARD, portions: 1, rolled: 15 }, occasion);

    const reordered = { ...STANDARD, kinds: [CRIMSON_ROOT_ID, MOON_HERB_ID] };
    const repeated = craftBatch(developed, { formula: reordered, portions: 1 }, occasion);
    expect(repeated.log.at(-1)?.summaryRu).toBe(
      "Изготовлено: Лечение здоровья, 1 единица. Истрачено по 1 порции: Багровый корень, Лунная трава",
    );

    expect(() =>
      craftBatch(developed, { formula: { ...STANDARD, duration: "1 минута" }, portions: 1 }, occasion),
    ).toThrow(/назовите выпавшее/);

    expect(() =>
      craftBatch(developed, { formula: { ...STANDARD, duration: "24 часа" }, portions: 1 }, occasion),
    ).toThrow(/выше предела оснащения/);

    const risky = craftBatch(
      stocked(6),
      { formula: STANDARD, portions: 1, rolled: 15, risky: true },
      occasion,
    );
    expect(() => craftBatch(risky, { formula: STANDARD, portions: 1 }, occasion)).toThrow(
      /назовите выпавшее/,
    );
  });

  it("состав с оставшимся ядовитым свойством партией не выходит: направление закрыто", () => {
    const hybrid = poisonous();

    expect(() =>
      craftBatch(hybrid, { formula: HYBRID, portions: 1, rolled: 11 }, occasion),
    ).toThrow(/ядов не варят/);
  });

  it("провал тратит заложенное и рецепта не записывает", () => {
    const stock = stocked(6);
    const failed = craftBatch(stock, { formula: STANDARD, portions: 2, rolled: 2 }, occasion);

    expect(bagCount(failed, MOON_HERB)).toBe(4);
    expect(failed.log.at(-1)?.summaryRu).toBe(
      "Не вышло: Лечение здоровья. Проверка 9 против 10. Истрачено по 2 порции: Лунная трава, Багровый корень",
    );
    expect(() => craftBatch(failed, { formula: STANDARD, portions: 1 }, occasion)).toThrow(
      /назовите выпавшее/,
    );
  });

  it("натуральная единица роняет рецепт и называет последствие таблицей", () => {
    const stock = stocked(6);
    expect(() => craftBatch(stock, { formula: STANDARD, portions: 1, rolled: 1 }, occasion)).toThrow(
      /назовите выпавшее на d6/,
    );

    const mishap = craftBatch(
      stock,
      { formula: STANDARD, portions: 1, rolled: 1, mishapRolled: 5 },
      occasion,
    );
    expect(mishap.log.at(-1)?.summaryRu).toBe(
      "Авария: Лечение здоровья. Смесь воздействует на область радиусом 1 метр. Истрачено по 1 порции: Лунная трава, Багровый корень",
    );
  });

  it("натуральная двадцать при успехе называет свою награду", () => {
    const crafted = craftBatch(stocked(6), { formula: STANDARD, portions: 1, rolled: 20 }, occasion);

    expect(crafted.log.at(-1)?.summaryRu).toContain("Натуральная двадцать");
  });
});

describe("полнота знания о виде", () => {
  it("отметка о полноте знания возвращается логом", () => {
    const before: Session = {
      character: withIngredientKnowledge(createThorne(), MOON_HERB, [HEALING]),
      log: [],
    };

    const marked = markPropertiesExhausted(
      before,
      { itemId: Items.idFromName(MOON_HERB), exhausted: true },
      occasion,
    );

    expect(exhaustedOf(marked, MOON_HERB)).toBe(true);
    expect(marked.log.at(-1)?.summaryRu).toBe(`У вида больше нет свойств: ${MOON_HERB}`);

    expect(exhaustedOf(undoLast(marked), MOON_HERB)).toBe(false);
  });
});
