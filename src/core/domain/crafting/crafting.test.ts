import { describe, expect, it } from "vitest";

import type { Apparatus } from "./apparatus";
import { Crafting, type MixtureKind } from "./crafting";
import type { RecipeFormula } from "./recipe";

const EMPTY = {
  alchemyApparatus: {},
  studiedDirections: [],
  propertyRarities: [],
  knownRecipes: [],
};

/** Редкость называет стол один раз на свойство: у алхимика она и записана. */
const NAMED_RARITIES = [
  { nameRu: "Лечение здоровья", rarity: "common" },
  { nameRu: "Пробуждение", rarity: "common" },
  { nameRu: "Храбрость", rarity: "common" },
  { nameRu: "Взрыв", rarity: "rare" },
  { nameRu: "Ядовитый урон", rarity: "rare" },
] as const;

const ALCHEMIST = NAMED_RARITIES.reduce(
  (crafting, named) => crafting.nameRarity(named.nameRu, named.rarity),
  Crafting.of(EMPTY),
);

type Property = MixtureKind["properties"][number];

describe("ремесло", () => {
  it("ремесло владеет только своими полями состояния", () => {
    expect(Crafting.of(EMPTY).toState()).toEqual(EMPTY);
  });

  it("названная редкость свойства достаётся всякому виду, у которого оно раскрыто", () => {
    expect(ALCHEMIST.rarityOf("Лечение здоровья")).toBe("common");
    expect(ALCHEMIST.rarityOf("Ясность ума")).toBeUndefined();
  });

  it("названная заново редкость заменяет прежнюю, а не добавляется второй", () => {
    const corrected = ALCHEMIST.nameRarity("Лечение здоровья", "legendary");

    expect(corrected.rarityOf("Лечение здоровья")).toBe("legendary");
    expect(corrected.toState().propertyRarities).toHaveLength(NAMED_RARITIES.length);
  });
});

function kindOf(nameRu: string, ...properties: readonly Property[]): MixtureKind {
  return { id: nameRu, nameRu, properties };
}

const HEALING = { number: 1, nameRu: "Лечение здоровья" } as const;

function twoKinds(): readonly MixtureKind[] {
  return [
    kindOf("Лунная трава", HEALING, { number: 2, nameRu: "Пробуждение" }),
    kindOf("Багровый корень", HEALING, { number: 2, nameRu: "Взрыв" }),
  ];
}

function sharing(kinds: readonly string[], property: Property): readonly MixtureKind[] {
  return kinds.map((nameRu) => kindOf(nameRu, property));
}

function sharingHealing(kinds: readonly string[]): readonly MixtureKind[] {
  return sharing(kinds, HEALING);
}

const FOUR_KINDS = ["Лунная трава", "Багровый корень", "Пепельный гриб", "Соль пустыни"];

describe("совпадения", () => {
  it("совпавшим считается свойство от двух и более разных источников", () => {
    expect(ALCHEMIST.matches(twoKinds())).toEqual([
      {
        nameRu: "Лечение здоровья",
        rarity: "common",
        sources: ["Лунная трава", "Багровый корень"],
        tier: "plain",
      },
    ]);
  });

  it("несколько порций одного вида совпадения не создают", () => {
    expect(() => ALCHEMIST.matches([twoKinds()[0]!, twoKinds()[0]!])).toThrow(
      /двух разных видов/,
    );
  });

  it("в составе действуют все совпавшие свойства, а не только желаемое", () => {
    const unwanted = [
      ...twoKinds(),
      kindOf("Пепельный гриб", HEALING, { number: 2, nameRu: "Взрыв" }),
    ];

    expect(ALCHEMIST.matches(unwanted).map((match) => match.nameRu)).toEqual([
      "Лечение здоровья",
      "Взрыв",
    ]);
  });

  it("три источника дают усиленную ступень, четыре — концентрированную", () => {
    const three = sharingHealing(FOUR_KINDS.slice(0, 3));

    expect(ALCHEMIST.matches(three).map((match) => match.tier)).toEqual(["amplified"]);
    expect(ALCHEMIST.matches(sharingHealing(FOUR_KINDS)).map((match) => match.tier)).toEqual([
      "concentrated",
    ]);
  });

  it("рецепт не собирается больше чем из четырёх видов", () => {
    const five = [...FOUR_KINDS, "Ледяной мох"];

    expect(() => ALCHEMIST.matches(sharingHealing(five))).toThrow(/четырёх/);
  });

  it("у свойства без названной редкости совпадение остаётся, а редкости нет", () => {
    const unnamed = sharing(TWO_KINDS, { number: 1, nameRu: "Ясность ума" });

    expect(Crafting.of(EMPTY).matches(unnamed)).toEqual([
      { nameRu: "Ясность ума", rarity: undefined, sources: TWO_KINDS, tier: "plain" },
    ]);
  });
});

const TWO_KINDS = FOUR_KINDS.slice(0, 2);
const THREE_KINDS = FOUR_KINDS.slice(0, 3);
const POISON = { number: 2, nameRu: "Ядовитый урон" } as const;

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

const GRAND_KITS: Apparatus = {
  potions: "Великий лабораторный модуль",
  poisons: "Великий лабораторный модуль",
  transmutation: "Великий лабораторный модуль",
};

const TORN_KITS: Apparatus = {
  potions: "Надёжный походный комплект",
  transmutation: "Надёжный походный комплект",
};

function grand(kinds: readonly MixtureKind[], changes: Partial<RecipeFormula>) {
  return ALCHEMIST.difficultyOf(kinds, { ...STANDARD, ...changes }, GRAND_KITS);
}

function healingAndPoison(): readonly MixtureKind[] {
  return TWO_KINDS.map((nameRu) => kindOf(nameRu, HEALING, POISON));
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

  it("неназванным основным становится самый редкий из оставшихся", () => {
    const rarest = grand(healingAndPoison(), { mainProperty: null });

    expect(rarest.mainRu).toBe("Ядовитый урон");
    expect(rarest.total).toBe(17);
  });

  it("подавление, снявшее всё, оставляет состав без единого свойства", () => {
    expect(() =>
      grand(sharingHealing(TWO_KINDS), {
        mainProperty: null,
        suppressed: ["Лечение здоровья"],
      }),
    ).toThrow(/не осталось ни одного свойства/);
  });

  it("названное основным, но снятое очисткой, отвергается своим именем", () => {
    expect(() =>
      grand(healingAndPoison(), { mainProperty: "Ядовитый урон", purification: "beneficial" }),
    ).toThrow(/«Ядовитый урон» в нём нет/);
  });

  it("основным бывает только оставшееся в составе свойство", () => {
    expect(() =>
      grand(healingAndPoison(), { purification: "harmful" }),
    ).toThrow(/Лечение здоровья/);
  });
});

describe("порядок исследования", () => {
  const equipped = Crafting.of({ ...EMPTY, alchemyApparatus: TORN_KITS });
  const moonHerb = (...properties: readonly Property[]): MixtureKind =>
    kindOf("Лунная трава", ...properties);

  it("следующим исследуют наименьший нераскрытый номер, и через него не перепрыгивают", () => {
    const bare = moonHerb();

    expect(equipped.researchPlanFor(bare, 1, "common", "potions").minutes).toBe(10);
    expect(() => equipped.researchPlanFor(bare, 2, "common", "potions")).toThrow(
      /сейчас это свойство под номером 1/,
    );
  });

  it("раскрытое глубже порядка не отменяет: следующим остаётся пропуск в середине", () => {
    const skipped = moonHerb({ number: 3, nameRu: "Взрыв" });

    expect(equipped.researchPlanFor(skipped, 1, "common", "potions").number).toBe(1);
    expect(() => equipped.researchPlanFor(skipped, 3, "common", "potions")).toThrow(
      /сейчас это свойство под номером 1/,
    );
  });

  it("у вида со всеми четырьмя свойствами исследовать нечего", () => {
    const full = moonHerb(
      { number: 1, nameRu: "Лечение здоровья" },
      { number: 2, nameRu: "Пробуждение" },
      { number: 3, nameRu: "Взрыв" },
      { number: 4, nameRu: "Храбрость" },
    );

    expect(() => equipped.researchPlanFor(full, 1, "common", "potions")).toThrow(
      /раскрыты все свойства/,
    );
  });

  it("раскрытое у вида называет свои направления по одному разу", () => {
    const known = moonHerb(
      { number: 1, nameRu: "Лечение здоровья" },
      { number: 2, nameRu: "Пробуждение" },
      { number: 3, nameRu: "Взрыв" },
    );

    expect(equipped.directionsOf(known)).toEqual(["potions", "transmutation"]);
  });
});

describe("записанный рецепт", () => {
  const known = ALCHEMIST;

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
    const batch = ALCHEMIST.batchOf(sharingHealing(TWO_KINDS), STANDARD, TORN_KITS, 6);

    expect(batch.difficulty.total).toBe(10);
    expect(batch.minutes).toBe(30);
    expect(batch.consumables).toEqual({ nameRu: "Обычные", goldPerStartedHour: 1 });
    expect(batch.consumablesGold).toBe(2);
    expect(batch.units).toBe(7);
  });

  it("сложность выше предела набора отклоняется с причиной, называющей лишнее", () => {
    expect(() =>
      ALCHEMIST.batchOf(healingAndPoison(), { ...STANDARD, mainProperty: "Ядовитый урон" }, TORN_KITS, 1),
    ).toThrow(/Сложность 22 выше предела оснащения 20.*Редкость эффектов \+7, Оснащение \+5/);
  });

  it("работа без профильного набора добавляет пять и делит партию вдвое", () => {
    const risky = ALCHEMIST.batchOf(healingAndPoison(), STANDARD, TORN_KITS, 3);

    expect(risky.difficulty.parts).toContainEqual({ nameRu: "Оснащение", modifier: 5 });
    expect(risky.difficulty.total).toBe(20);
    expect(risky.units).toBe(3);
    expect(() => ALCHEMIST.batchOf(healingAndPoison(), STANDARD, TORN_KITS, 4)).toThrow(/предел партии/);
  });

  it("время партии и класс расходников растут полосами сложности", () => {
    const hour = ALCHEMIST.batchOf(sharing(TWO_KINDS, POISON), 
      { ...STANDARD, mainProperty: "Ядовитый урон", duration: "1 час" },
      GRAND_KITS,
      1,
    );
    const sprayed = ALCHEMIST.batchOf(sharing(THREE_KINDS, POISON), 
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
    const forever = ALCHEMIST.nameRarity("Лечение здоровья", "legendary").batchOf(
      sharingHealing(TWO_KINDS),
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

    expect(() => ALCHEMIST.batchOf(known, STANDARD, TORN_KITS, 0)).toThrow(/целое положительное/);
    expect(() => ALCHEMIST.batchOf(known, STANDARD, TORN_KITS, 2.5)).toThrow(
      /целое положительное/,
    );
  });

  it("без единого набора работают импровизированными сосудами", () => {
    const bare = ALCHEMIST.batchOf(sharingHealing(TWO_KINDS), STANDARD, {}, 1);

    expect(bare.difficulty.total).toBe(15);
    expect(bare.units).toBe(1);
    expect(() => ALCHEMIST.batchOf(sharingHealing(TWO_KINDS), STANDARD, {}, 2)).toThrow(/предел партии/);
  });

  it("рецепт называет задействованные направления", () => {
    const hybrid = ALCHEMIST.batchOf(healingAndPoison(), STANDARD, TORN_KITS, 1);

    expect(hybrid.difficulty.directions).toEqual(["potions", "poisons"]);
  });
});
