import { describe, expect, it } from "vitest";

import { Crafting } from "./crafting";
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
function sharingHealing(kinds: readonly string[]): Crafting {
  return kinds.reduce((known, kind) => noting(known, kind, HEALING), Crafting.of(EMPTY));
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
