import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { undoLast, type Occasion, type Session } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";
import { addItem, adjustBagCount } from "./equipment";
import { craftBatch, markPropertiesExhausted } from "./crafting";

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

/** Установил ли стол, что свойств у вида больше нет. */
function exhaustedOf(session: Session, nameRu: string): boolean | undefined {
  return Character.of(session.character).crafting.find(nameRu)?.propertiesExhausted;
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

const POISON = { number: 2, nameRu: "Ядовитый урон", rarity: "rare" } as const;

/** Гибрид: у обоих видов совпало и лечение, и яд, а набора токсиколога у Торна нет. */
const HYBRID: RecipeFormula = { ...STANDARD };

function poisonous(): Session {
  const known = [MOON_HERB, CRIMSON_ROOT].reduce(
    (character, kind) => withIngredientKnowledge(character, kind, [HEALING, POISON]),
    createThorne(),
  );
  return [MOON_HERB, CRIMSON_ROOT].reduce<Session>(
    (session, kind) =>
      adjustBagCount(
        addItem(session, { nameRu: kind, kind: "ingredient" }, occasion),
        Items.idFromName(kind),
        5,
        occasion,
      ),
    { character: known, journal: [] },
  );
}

describe("изготовление состава", () => {
  it("изготовление списывает все виды одной записью журнала", () => {
    const before = stocked(6);
    const entriesBefore = before.journal.length;

    const crafted = craftBatch(before, { formula: STANDARD, portions: 4, rolled: 15 }, occasion);

    expect(bagCount(crafted, MOON_HERB)).toBe(2);
    expect(bagCount(crafted, CRIMSON_ROOT)).toBe(2);
    expect(crafted.journal).toHaveLength(entriesBefore + 1);
    expect(crafted.journal.at(-1)?.summaryRu).toBe(
      "Изготовлено: Лечение здоровья, 5 единиц. Проверка 22 против 10. Истрачено по 4 порции: Лунная трава, Багровый корень",
    );

    // Одна запись — одна отмена: возвращаются оба вида разом, а не половина рецепта.
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
    // Первая работа — с проверкой: рецепта ещё нет, и без выпавшего изготовление не идёт.
    const first = stocked(6);
    expect(() => craftBatch(first, { formula: STANDARD, portions: 1 }, occasion)).toThrow(
      /назовите выпавшее/,
    );

    const developed = craftBatch(first, { formula: STANDARD, portions: 1, rolled: 15 }, occasion);

    // Первое условие: те же виды. Порядок выбора рецепта не меняет, замена вида — меняет.
    const reordered = { ...STANDARD, kinds: [CRIMSON_ROOT, MOON_HERB] };
    const repeated = craftBatch(developed, { formula: reordered, portions: 1 }, occasion);
    expect(repeated.journal.at(-1)?.summaryRu).toBe(
      "Изготовлено: Лечение здоровья, 1 единица. Истрачено по 1 порции: Багровый корень, Лунная трава",
    );

    // Второе условие: параметры не меняются. Другая длительность — другая формула.
    expect(() =>
      craftBatch(developed, { formula: { ...STANDARD, duration: "1 минута" }, portions: 1 }, occasion),
    ).toThrow(/назовите выпавшее/);

    // Третье условие: оснащение выдерживает итоговую сложность.
    expect(() =>
      craftBatch(developed, { formula: { ...STANDARD, duration: "24 часа" }, portions: 1 }, occasion),
    ).toThrow(/выше предела оснащения/);

    // Четвёртое условие: у рецепта нет отдельного риска, требующего проверки каждой партии.
    const risky = craftBatch(
      stocked(6),
      { formula: STANDARD, portions: 1, rolled: 15, risky: true },
      occasion,
    );
    expect(() => craftBatch(risky, { formula: STANDARD, portions: 1 }, occasion)).toThrow(
      /назовите выпавшее/,
    );
  });

  it("гибрид с ядовитым свойством роняет проверку до наименьшего бонуса", () => {
    // Торн обучен зельеварению, но не синтезу ядов: 1к20 + 4 вместо 1к20 + 7.
    const hybrid = poisonous();
    const failed = craftBatch(hybrid, { formula: HYBRID, portions: 1, rolled: 11 }, occasion);

    expect(failed.journal.at(-1)?.summaryRu).toContain("Не вышло: Лечение здоровья. Проверка 15");
  });

  it("провал тратит заложенное и рецепта не записывает", () => {
    const stock = stocked(6);
    const failed = craftBatch(stock, { formula: STANDARD, portions: 2, rolled: 2 }, occasion);

    expect(bagCount(failed, MOON_HERB)).toBe(4);
    expect(failed.journal.at(-1)?.summaryRu).toBe(
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
    expect(mishap.journal.at(-1)?.summaryRu).toBe(
      "Авария: Лечение здоровья. Смесь воздействует на область радиусом 1 метр. Истрачено по 1 порции: Лунная трава, Багровый корень",
    );
  });

  it("натуральная двадцать при успехе называет свою награду", () => {
    const crafted = craftBatch(stocked(6), { formula: STANDARD, portions: 1, rolled: 20 }, occasion);

    expect(crafted.journal.at(-1)?.summaryRu).toContain("Натуральная двадцать");
  });
});

describe("полнота знания о виде", () => {
  it("отметка о полноте знания возвращается журналом", () => {
    // Запас тут ни при чём: отметка — про знание о виде, и сумку она не спрашивает.
    const before: Session = {
      character: withIngredientKnowledge(createThorne(), MOON_HERB, [HEALING]),
      journal: [],
    };

    const marked = markPropertiesExhausted(before, { nameRu: MOON_HERB, exhausted: true }, occasion);

    expect(exhaustedOf(marked, MOON_HERB)).toBe(true);
    expect(marked.journal.at(-1)?.summaryRu).toBe(`У вида больше нет свойств: ${MOON_HERB}`);

    // Ошибочно сказанное за столом возвращается так же, как всё прочее записанное.
    expect(exhaustedOf(undoLast(marked), MOON_HERB)).toBe(false);
  });
});
