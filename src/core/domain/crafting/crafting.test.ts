import { describe, expect, it } from "vitest";

import { Crafting } from "./crafting";
import type { RecipeFormula } from "./recipe";
import type { RevealedProperty } from "./schema";

const EMPTY = { ingredientKnowledge: [] };

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
    expect(Crafting.of(EMPTY).toState()).toEqual({ ingredientKnowledge: [] });
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
    const unwanted = noting(twoKinds(), "Пепельный гриб", HEALING).revealProperty("Пепельный гриб", {
      number: 2,
      nameRu: "Взрыв",
      rarity: "rare",
    });

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

/** Смесь, где совпало и полезное, и вредное: на такой и работают очистка с подавлением. */
function healingAndPoison(): Crafting {
  return TWO_KINDS.reduce(
    (known, kind) => noting(known, kind, HEALING).revealProperty(kind, POISON),
    Crafting.of(EMPTY),
  );
}

describe("сложность рецепта", () => {
  it("простой рецепт справочника стоит базовых десяти", () => {
    expect(sharingHealing(TWO_KINDS).difficultyOf(STANDARD).total).toBe(10);
  });

  it("сложность складывается из восьми групп и не падает ниже пяти", () => {
    const sprayed = sharing(THREE_KINDS, POISON).difficultyOf({
      ...STANDARD,
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
    ]);
    expect(sprayed.total).toBe(30);

    const crippled = sharingHealing(TWO_KINDS).difficultyOf({
      ...STANDARD,
      duration: "1 раунд",
      resistance: "Спасбросок с преимуществом",
      limitations: ["Неизбежное опасное последствие"],
    });

    expect(crippled.total).toBe(5);
  });

  it("ограничения снижают сложность не больше чем на шесть", () => {
    const limited = sharing(TWO_KINDS, POISON).difficultyOf({
      ...STANDARD,
      mainProperty: "Ядовитый урон",
      limitations: ["Неизбежное опасное последствие", "Неизбежный серьёзный побочный эффект"],
    });

    expect(limited.total).toBe(9);
  });

  it("мгновенный эффект таблицей длительности не пользуется", () => {
    const lasting = sharingHealing(TWO_KINDS).difficultyOf({ ...STANDARD, duration: "1 час" });

    expect(lasting.total).toBe(16);
  });

  it("каждое дополнительное полное срабатывание стоит трёх, но не больше двенадцати", () => {
    const twice = sharingHealing(TWO_KINDS).difficultyOf({ ...STANDARD, fullRepeats: 2 });
    const many = sharingHealing(TWO_KINDS).difficultyOf({ ...STANDARD, fullRepeats: 9 });

    expect(twice.total).toBe(16);
    expect(many.total).toBe(22);
  });

  it("дополнительных полных срабатываний не бывает дробным или отрицательным числом", () => {
    const known = sharingHealing(TWO_KINDS);

    expect(() => known.difficultyOf({ ...STANDARD, fullRepeats: 1.5 })).toThrow(/срабатыван/);
    expect(() => known.difficultyOf({ ...STANDARD, fullRepeats: -1 })).toThrow(/срабатыван/);
  });

  it("дополнительный эффект оплачивается своей редкостью", () => {
    const healing = healingAndPoison().difficultyOf(STANDARD);
    const poisonous = healingAndPoison().difficultyOf({
      ...STANDARD,
      mainProperty: "Ядовитый урон",
    });

    expect(healing.total).toBe(15);
    expect(poisonous.total).toBe(17);
  });

  it("очистка стоит пяти и снимает свойства противоположной направленности", () => {
    const purified = healingAndPoison().difficultyOf({ ...STANDARD, purification: "beneficial" });

    expect(purified.parts).toContainEqual({ nameRu: "Очистка и подавление", modifier: 5 });
    expect(purified.total).toBe(15);
  });

  it("подавление стоит по редкости подавляемого свойства", () => {
    const suppressed = healingAndPoison().difficultyOf({
      ...STANDARD,
      suppressed: ["Ядовитый урон"],
    });

    expect(suppressed.total).toBe(14);
  });

  it("очищать нечего, когда в составе нет обеих направленностей", () => {
    const known = sharingHealing(TWO_KINDS);

    expect(() => known.difficultyOf({ ...STANDARD, purification: "beneficial" })).toThrow(
      /очистк/i,
    );
    expect(() => known.difficultyOf({ ...STANDARD, purification: "harmful" })).toThrow(/очистк/i);
  });

  it("удалённое очисткой второй раз не подавляется", () => {
    expect(() =>
      healingAndPoison().difficultyOf({
        ...STANDARD,
        purification: "beneficial",
        suppressed: ["Ядовитый урон"],
      }),
    ).toThrow(/Ядовитый урон/);
  });

  it("подавить можно только совпавшее свойство", () => {
    expect(() =>
      healingAndPoison().difficultyOf({ ...STANDARD, suppressed: ["Взрыв"] }),
    ).toThrow(/Взрыв/);
  });

  it("основным бывает только оставшееся в составе свойство", () => {
    expect(() =>
      healingAndPoison().difficultyOf({ ...STANDARD, purification: "harmful" }),
    ).toThrow(/Лечение здоровья/);
  });
});
