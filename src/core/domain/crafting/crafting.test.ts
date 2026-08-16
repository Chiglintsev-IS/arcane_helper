import { describe, expect, it } from "vitest";

import type { Apparatus } from "./apparatus";
import { Crafting } from "./crafting";
import type { RecipeFormula } from "./recipe";
import type { RevealedProperty } from "./schema";

const EMPTY = {
  ingredientKnowledge: [],
  alchemyApparatus: {},
  studiedDirections: [],
  knownRecipes: [],
};

function withMoonHerb(): Crafting {
  return Crafting.of(EMPTY).noteIngredient("Лунная трава");
}

describe("ремесло", () => {
  it("вид записывается один раз", () => {
    const twice = withMoonHerb().noteIngredient("Лунная трава");

    expect(twice.all).toHaveLength(1);
    expect(twice.find("Лунная трава")?.nameRu).toBe("Лунная трава");
  });

  it("незаписанного вида среди записанных нет", () => {
    expect(Crafting.of(EMPTY).find("Лунная трава")).toBeUndefined();
  });

  it("свойство раскрывается только у записанного вида", () => {
    expect(() =>
      Crafting.of(EMPTY).revealProperty("Лунная трава", {
        number: 1,
        nameRu: "Лечение здоровья",
        rarity: "common",
      }),
    ).toThrow(/Лунная трава/);
  });

  it("раскрытое свойство встаёт под своим номером", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 1, nameRu: "Лечение здоровья", rarity: "common" })
      .find("Лунная трава");

    expect(known?.properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
    ]);
  });

  it("раскрытое у одного вида не трогает соседний", () => {
    const both = withMoonHerb().noteIngredient("Багровый корень");
    const revealed = both.revealProperty("Лунная трава", {
      number: 1,
      nameRu: "Лечение здоровья",
      rarity: "common",
    });

    expect(revealed.find("Багровый корень")?.properties).toEqual([]);
    expect(revealed.all.map((ingredient) => ingredient.nameRu)).toEqual([
      "Лунная трава",
      "Багровый корень",
    ]);
  });

  it("номер раскрывается через нераскрытый предыдущий", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 3, nameRu: "Взрыв", rarity: "rare" })
      .find("Лунная трава");

    expect(known?.properties.map((property) => property.number)).toEqual([3]);
  });

  it("занятый номер второй раз не раскрывается", () => {
    const once = withMoonHerb().revealProperty("Лунная трава", {
      number: 1,
      nameRu: "Лечение здоровья",
      rarity: "common",
    });

    expect(() =>
      once.revealProperty("Лунная трава", { number: 1, nameRu: "Взрыв", rarity: "rare" }),
    ).toThrow(/номером 1/);
  });

  it("раскрытое у вида называет свои направления по одному разу", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 1, nameRu: "Лечение здоровья", rarity: "common" })
      .revealProperty("Лунная трава", { number: 2, nameRu: "Пробуждение", rarity: "common" })
      .revealProperty("Лунная трава", { number: 3, nameRu: "Взрыв", rarity: "rare" });

    expect(known.directionsOf("Лунная трава")).toEqual(["potions", "transmutation"]);
  });

  it("направления незаписанного вида не называются", () => {
    expect(() => Crafting.of(EMPTY).directionsOf("Лунная трава")).toThrow(/Лунная трава/);
  });

  it("записанное по ошибке забывается", () => {
    expect(withMoonHerb().forgetIngredient("Лунная трава").all).toEqual([]);
    expect(() => Crafting.of(EMPTY).forgetIngredient("Лунная трава")).toThrow(/Лунная трава/);
  });

  it("ремесло владеет только своим полем состояния", () => {
    expect(Crafting.of(EMPTY).toState()).toEqual(EMPTY);
  });
});

/** Вид с одним раскрытым свойством: столько знания хватает, чтобы искать совпадения. */
function noting(known: Crafting, nameRu: string, property: RevealedProperty): Crafting {
  return known.noteIngredient(nameRu).revealProperty(nameRu, property);
}

const HEALING = { number: 1, nameRu: "Лечение здоровья", rarity: "common" } as const;

/** Два вида, совпадающих «Лечением здоровья», и у каждого своё несовпавшее свойство. */
function twoKinds(): Crafting {
  const moonHerb = noting(Crafting.of(EMPTY), "Лунная трава", HEALING).revealProperty(
    "Лунная трава",
    { number: 2, nameRu: "Пробуждение", rarity: "common" },
  );
  return noting(moonHerb, "Багровый корень", HEALING).revealProperty("Багровый корень", {
    number: 2,
    nameRu: "Взрыв",
    rarity: "rare",
  });
}

/** Столько видов с одним и тем же свойством, сколько нужно для проверяемой ступени. */
function sharing(kinds: readonly string[], property: RevealedProperty): Crafting {
  return kinds.reduce((known, kind) => noting(known, kind, property), Crafting.of(EMPTY));
}

function sharingHealing(kinds: readonly string[]): Crafting {
  return sharing(kinds, HEALING);
}

const FOUR_KINDS = ["Лунная трава", "Багровый корень", "Пепельный гриб", "Соль пустыни"];

describe("совпадения", () => {
  it("совпавшим считается свойство от двух и более разных источников", () => {
    expect(twoKinds().matches(["Лунная трава", "Багровый корень"])).toEqual([
      {
        nameRu: "Лечение здоровья",
        rarity: "common",
        sources: ["Лунная трава", "Багровый корень"],
        tier: "plain",
      },
    ]);
  });

  it("несколько порций одного вида совпадения не создают", () => {
    expect(() => twoKinds().matches(["Лунная трава", "Лунная трава"])).toThrow(/двух разных видов/);
  });

  it("в составе действуют все совпавшие свойства, а не только желаемое", () => {
    const unwanted = noting(twoKinds(), "Пепельный гриб", HEALING).revealProperty(
      "Пепельный гриб",
      { number: 2, nameRu: "Взрыв", rarity: "rare" },
    );

    expect(
      unwanted
        .matches(["Лунная трава", "Багровый корень", "Пепельный гриб"])
        .map((match) => match.nameRu),
    ).toEqual(["Лечение здоровья", "Взрыв"]);
  });

  it("три источника дают усиленную ступень, четыре — концентрированную", () => {
    const three = sharingHealing(FOUR_KINDS.slice(0, 3));

    expect(three.matches(FOUR_KINDS.slice(0, 3)).map((match) => match.tier)).toEqual(["amplified"]);
    expect(sharingHealing(FOUR_KINDS).matches(FOUR_KINDS).map((match) => match.tier)).toEqual([
      "concentrated",
    ]);
  });

  it("рецепт не собирается больше чем из четырёх видов", () => {
    const five = [...FOUR_KINDS, "Ледяной мох"];

    expect(() => sharingHealing(five).matches(five)).toThrow(/четырёх/);
  });

  it("разная редкость одного свойства у двух видов отклоняется с причиной", () => {
    const uneven = noting(sharingHealing(["Лунная трава"]), "Багровый корень", {
      ...HEALING,
      rarity: "rare",
    });

    expect(() => uneven.matches(["Лунная трава", "Багровый корень"])).toThrow(
      /Лечение здоровья.*Лунная трава, Багровый корень/,
    );
  });
});

const TWO_KINDS = FOUR_KINDS.slice(0, 2);
const THREE_KINDS = FOUR_KINDS.slice(0, 3);
const POISON = { number: 2, nameRu: "Ядовитый урон", rarity: "rare" } as const;

/** Стандартная форма справочника: одна цель, немедленное начало, одно срабатывание. */
const STANDARD: RecipeFormula = {
  kinds: TWO_KINDS,
  mainProperty: "Лечение здоровья",
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

/** Оснащение, которое ничему не мешает: пределы его выше всего, что встречается в прогонах. */
const GRAND_KITS: Apparatus = {
  potions: "Великий лабораторный модуль",
  poisons: "Великий лабораторный модуль",
  transmutation: "Великий лабораторный модуль",
};

/** Оснащение Торна: надёжные походные комплекты по изученным направлениям и ничего по ядам. */
const TORN_KITS: Apparatus = {
  potions: "Надёжный походный комплект",
  transmutation: "Надёжный походный комплект",
};

/** Сложность стандартной формы с названными отличиями. */
function grand(known: Crafting, changes: Partial<RecipeFormula>) {
  return known.difficultyOf({ ...STANDARD, ...changes }, GRAND_KITS);
}

/** Смесь, где совпало и полезное, и вредное: на такой и работают очистка с подавлением. */
function healingAndPoison(): Crafting {
  return TWO_KINDS.reduce(
    (known, kind) => noting(known, kind, HEALING).revealProperty(kind, POISON),
    Crafting.of(EMPTY),
  );
}

describe("сложность рецепта", () => {
  it("простой рецепт справочника стоит базовых десяти", () => {
    expect(grand(sharingHealing(TWO_KINDS), {}).total).toBe(10);
  });

  it("сложность складывается из восьми групп и не падает ниже пяти", () => {
    const sprayed = grand(sharing(THREE_KINDS, POISON), {
      kinds: THREE_KINDS,
      mainProperty: "Ядовитый урон",
      duration: "1 минута",
      reach: "Радиус 2 м",
      application: "Вдохнуть или распылить",
      resistance: "Успех уменьшает эффект вдвое",
    });

    expect(sprayed.parts).toEqual([
      { nameRu: "Редкость эффектов", modifier: 5 },
      { nameRu: "Ступень усиления", modifier: 3 },
      { nameRu: "Длительность", modifier: 2 },
      { nameRu: "Начало действия", modifier: 0 },
      { nameRu: "Периодичность", modifier: 0 },
      { nameRu: "Цели и область", modifier: 5 },
      { nameRu: "Способ применения", modifier: 3 },
      { nameRu: "Сопротивление", modifier: 2 },
      { nameRu: "Очистка и подавление", modifier: 0 },
      { nameRu: "Ограничения и последствия", modifier: 0 },
      { nameRu: "Оснащение", modifier: 0 },
    ]);
    expect(sprayed.total).toBe(30);

    const crippled = grand(sharingHealing(TWO_KINDS), {
      duration: "1 раунд",
      resistance: "Спасбросок с преимуществом",
      limitations: ["Неизбежное опасное последствие"],
    });

    expect(crippled.total).toBe(5);
  });

  it("ограничения снижают сложность не больше чем на шесть", () => {
    const limited = grand(sharing(TWO_KINDS, POISON), {
      mainProperty: "Ядовитый урон",
      limitations: ["Неизбежное опасное последствие", "Неизбежный серьёзный побочный эффект"],
    });

    expect(limited.total).toBe(9);
  });

  it("мгновенный эффект таблицей длительности не пользуется", () => {
    const lasting = grand(sharingHealing(TWO_KINDS), { duration: "1 час" });

    expect(lasting.total).toBe(16);
  });

  it("каждое дополнительное полное срабатывание стоит трёх, но не больше двенадцати", () => {
    const twice = grand(sharingHealing(TWO_KINDS), { fullRepeats: 2 });
    const many = grand(sharingHealing(TWO_KINDS), { fullRepeats: 9 });

    expect(twice.total).toBe(16);
    expect(many.total).toBe(22);
  });

  it("дополнительных полных срабатываний не бывает дробным или отрицательным числом", () => {
    const known = sharingHealing(TWO_KINDS);

    expect(() => grand(known, { fullRepeats: 1.5 })).toThrow(/срабатыван/);
    expect(() => grand(known, { fullRepeats: -1 })).toThrow(/срабатыван/);
  });

  it("дополнительный эффект оплачивается своей редкостью", () => {
    const healing = grand(healingAndPoison(), {});
    const poisonous = grand(healingAndPoison(), { mainProperty: "Ядовитый урон" });

    expect(healing.total).toBe(15);
    expect(poisonous.total).toBe(17);
  });

  it("очистка стоит пяти и снимает свойства противоположной направленности", () => {
    const purified = grand(healingAndPoison(), { purification: "beneficial" });

    expect(purified.parts).toContainEqual({ nameRu: "Очистка и подавление", modifier: 5 });
    expect(purified.total).toBe(15);
  });

  it("подавление стоит по редкости подавляемого свойства", () => {
    const suppressed = grand(healingAndPoison(), { suppressed: ["Ядовитый урон"] });

    expect(suppressed.total).toBe(14);
  });

  it("очищать нечего, когда в составе нет обеих направленностей", () => {
    const known = sharingHealing(TWO_KINDS);

    expect(() => grand(known, { purification: "beneficial" })).toThrow(/очистк/i);
    expect(() => grand(known, { purification: "harmful" })).toThrow(/очистк/i);
  });

  it("удалённое очисткой второй раз не подавляется", () => {
    expect(() =>
      grand(healingAndPoison(), { purification: "beneficial", suppressed: ["Ядовитый урон"] }),
    ).toThrow(/Ядовитый урон/);
  });

  it("подавить можно только совпавшее свойство", () => {
    expect(() =>
      grand(healingAndPoison(), { suppressed: ["Взрыв"] }),
    ).toThrow(/Взрыв/);
  });

  it("основным бывает только оставшееся в составе свойство", () => {
    expect(() =>
      grand(healingAndPoison(), { purification: "harmful" }),
    ).toThrow(/Лечение здоровья/);
  });
});

describe("записанный рецепт", () => {
  const known = sharingHealing(TWO_KINDS);

  it("замена даже одного вида даёт другую формулу и новую разработку", () => {
    const developed = known.recordRecipe(STANDARD, false);

    expect(developed.knows(STANDARD)).toBe(true);
    expect(developed.knows({ ...STANDARD, kinds: ["Лунная трава", "Пепельный гриб"] })).toBe(false);
  });

  it("рецепт с отдельным риском записан, но проверки не отменяет", () => {
    expect(known.recordRecipe(STANDARD, true).knows(STANDARD)).toBe(false);
  });

  it("второй раз тот же рецепт второй записи не заводит, а соседний остаётся", () => {
    const other = { ...STANDARD, duration: "1 минута" } as const;
    const both = known.recordRecipe(STANDARD, false).recordRecipe(other, false);
    const again = both.recordRecipe(STANDARD, false);

    expect(again.toState().knownRecipes).toHaveLength(2);
    expect(again.knows(other)).toBe(true);
  });
});

describe("партия и предел оснащения", () => {
  it("оснащение записано у алхимика и достаётся работе", () => {
    const equipped = Crafting.of({ ...EMPTY, alchemyApparatus: TORN_KITS });

    expect(equipped.apparatus).toEqual(TORN_KITS);
    expect(Crafting.of(EMPTY).apparatus).toEqual({});
  });

  it("предел оснащения Торна даёт из шести порций семь единиц", () => {
    const batch = sharingHealing(TWO_KINDS).batchOf(STANDARD, TORN_KITS, 6);

    expect(batch.difficulty.total).toBe(10);
    expect(batch.minutes).toBe(30);
    expect(batch.consumables).toEqual({ nameRu: "Обычные", goldPerStartedHour: 1 });
    expect(batch.consumablesGold).toBe(2);
    expect(batch.units).toBe(7);
  });

  it("сложность выше предела набора отклоняется с причиной, называющей лишнее", () => {
    expect(() =>
      healingAndPoison().batchOf({ ...STANDARD, mainProperty: "Ядовитый урон" }, TORN_KITS, 1),
    ).toThrow(/Сложность 22 выше предела оснащения 20.*Редкость эффектов \+7, Оснащение \+5/);
  });

  it("работа без профильного набора добавляет пять и делит партию вдвое", () => {
    const risky = healingAndPoison().batchOf(STANDARD, TORN_KITS, 3);

    expect(risky.difficulty.parts).toContainEqual({ nameRu: "Оснащение", modifier: 5 });
    expect(risky.difficulty.total).toBe(20);
    expect(risky.units).toBe(3);
    expect(() => healingAndPoison().batchOf(STANDARD, TORN_KITS, 4)).toThrow(/предел партии/);
  });

  it("время партии и класс расходников растут полосами сложности", () => {
    const hour = sharing(TWO_KINDS, POISON).batchOf(
      { ...STANDARD, mainProperty: "Ядовитый урон", duration: "1 час" },
      GRAND_KITS,
      1,
    );
    const sprayed = sharing(THREE_KINDS, POISON).batchOf(
      {
        ...STANDARD,
        kinds: THREE_KINDS,
        mainProperty: "Ядовитый урон",
        duration: "1 минута",
        reach: "Радиус 2 м",
        application: "Вдохнуть или распылить",
        resistance: "Успех уменьшает эффект вдвое",
      },
      GRAND_KITS,
      1,
    );
    const forever = sharing(TWO_KINDS, { ...HEALING, rarity: "legendary" }).batchOf(
      { ...STANDARD, duration: "Постоянно" },
      GRAND_KITS,
      1,
    );

    expect([hour.difficulty.total, hour.minutes, hour.consumables.nameRu]).toEqual([
      21,
      120,
      "Очищенные",
    ]);
    expect([sprayed.difficulty.total, sprayed.minutes, sprayed.consumables.nameRu]).toEqual([
      30,
      480,
      "Высокоточные",
    ]);
    expect([forever.difficulty.total, forever.minutes, forever.consumables.nameRu]).toEqual([
      42,
      1920,
      "Экзотические",
    ]);
  });

  it("рецептурных порций закладывают целое положительное число", () => {
    const known = sharingHealing(TWO_KINDS);

    expect(() => known.batchOf(STANDARD, TORN_KITS, 0)).toThrow(/целое положительное/);
    expect(() => known.batchOf(STANDARD, TORN_KITS, 2.5)).toThrow(/целое положительное/);
  });

  it("без единого набора работают импровизированными сосудами", () => {
    const bare = sharingHealing(TWO_KINDS).batchOf(STANDARD, {}, 1);

    expect(bare.difficulty.total).toBe(15);
    expect(bare.units).toBe(1);
    expect(() => sharingHealing(TWO_KINDS).batchOf(STANDARD, {}, 2)).toThrow(/предел партии/);
  });

  it("рецепт называет задействованные направления", () => {
    const hybrid = healingAndPoison().batchOf(STANDARD, TORN_KITS, 1);

    expect(hybrid.difficulty.directions).toEqual(["potions", "poisons"]);
  });
});
