import { describe, expect, it } from "vitest";

import {
  TIER_LABELS,
  difficultyRu,
  directionTone,
  formulaAsideRu,
  partValueRu,
  priceRu,
  goldPerHourRu,
  goldTotalRu,
  portionsRu,
  propertyMarks,
  rarityTone,
  researchNeedsRu,
  unitsRu,
} from "@/ui/entities/crafting/lib/labels";
import { labelled } from "@/ui/shared/lib/alchemyLabels";

describe("слово ремесла и подпись к нему", () => {
  it("известный код читается своей подписью", () => {
    expect(labelled(TIER_LABELS, "concentrated")).toBe("концентрированная");
  });

  it("ступень, которой словарь ещё не знает, доезжает до экрана своим словом", () => {
    expect(labelled(TIER_LABELS, "перегретая")).toBe("перегретая");
  });
});

const STANDARD = {
  duration: null,
  onset: "Немедленно",
  fullRepeats: 0,
  reach: "Одна цель, предмет или участок",
  application: "Выпить, накормить или нанести на неподвижную цель",
  resistance: "Положительное воздействие на добровольную цель",
  mainRarity: "Обычное",
  purified: false,
};

const FORMULA = {
  ...STANDARD,
  kinds: ["moon", "root"],
  mainProperty: "Лечение здоровья",
  suppressed: [],
  limitations: [],
};

describe("счёт порций и монет", () => {
  it("порции, единицы и цена называются по-русски", () => {
    expect(portionsRu(1)).toBe("1 порция");
    expect(portionsRu(5)).toBe("5 порций");
    expect(unitsRu(2)).toBe("2 единицы");
    expect(goldPerHourRu(10)).toBe("10 зм/ч");
    expect(goldTotalRu(160)).toBe("160 зм");
  });
});

describe("тон направления", () => {
  it("своё направление, чужое и неизвестное различаются тоном", () => {
    expect(directionTone("Зельеварение")).toBe("ritual");
    expect(directionTone("Синтез ядов")).toBe("damage");
    expect(directionTone("Трансмутация")).toBe("concentration");
    expect(directionTone(null)).toBe("muted");
    expect(directionTone("Кулинария")).toBe("muted");
  });
});

describe("чем замысел отличается от стандартного", () => {
  it("стандартная форма не называет ничего", () => {
    expect(formulaAsideRu(FORMULA, STANDARD)).toEqual([]);
  });

  it("каждое отличие названо своим словом справочника", () => {
    expect(
      formulaAsideRu(
        {
          ...FORMULA,
          duration: "1 час",
          onset: "Задержка до 1 минуты",
          reach: "Радиус 2 м",
          application: "Вдохнуть или распылить",
          resistance: "Эффект не допускает спасброска",
          mainRarity: "Редкое",
          fullRepeats: 2,
          purified: true,
          suppressed: [{ nameRu: "Диарея", rarityRu: "Обычное" }],
          limitations: ["Состав портится через 1 час"],
        },
        STANDARD,
      ),
    ).toEqual([
      "1 час",
      "Задержка до 1 минуты",
      "Радиус 2 м",
      "Вдохнуть или распылить",
      "Эффект не допускает спасброска",
      "Редкое",
      "повторов в полную силу: 2",
      "очистка смеси",
      "подавлено: Диарея",
      "Состав портится через 1 час",
    ]);
  });

  it("редкость окрашена по таблице, а неназванная и незнакомая — приглушена", () => {
    expect(rarityTone("Легендарное")).toBe("roll");
    expect(rarityTone("Очень редкое")).toBe("bonus");
    expect(rarityTone(null)).toBe("muted");
    expect(rarityTone("Небывалое")).toBe("muted");
  });

  it("направление и редкость читаются пометкой каждое, а особая редкость — без цвета", () => {
    /* Особое цвета себе не берёт: свободных в палитре нет, и всякий занятый спутали бы с другим. */
    expect(propertyMarks({ dirRu: "Зельеварение", rarityRu: "Особое" })).toEqual([
      { labelRu: "Зельеварение", tone: "ritual", special: false },
      { labelRu: "Особое", tone: "muted", special: true },
    ]);
    expect(propertyMarks({ dirRu: "Зельеварение", rarityRu: "Очень редкое" })).toEqual([
      { labelRu: "Зельеварение", tone: "ritual", special: false },
      { labelRu: "Очень редкое", tone: "bonus", special: false },
    ]);
    expect(propertyMarks({ dirRu: null, rarityRu: null })).toEqual([
      { labelRu: "направление неизвестно", tone: "muted", special: false },
    ]);
  });
});

describe("цена, которой справочник не называет", () => {
  it("цена ступени — число со знаком, цена особого — прочерк", () => {
    expect(priceRu(5)).toBe("+5");
    expect(priceRu(-2)).toBe("−2");
    expect(priceRu(null)).toBe("—");
  });

  it("слагаемое без цены стоит прочерком, а неоценённое с числом — своим числом", () => {
    expect(partValueRu({ modifier: 3, unpriced: false })).toBe("+3");
    expect(partValueRu({ modifier: 0, unpriced: true })).toBe("—");
    expect(partValueRu({ modifier: 4, unpriced: true })).toBe("+4");
  });

  it("неполный итог назван снизу, полный — самим числом", () => {
    expect(difficultyRu(17, false)).toBe("17");
    expect(difficultyRu(17, true)).toBe("17+");
  });
});

describe("чего стоит исследование", () => {
  const plan = {
    minutes: 120,
    difficulty: 15,
    portionsOnFailure: 2,
    portionsOnSuccess: 2,
    consumablesRu: null,
    consumablesGold: 0,
    rawSampleRu: null,
    laboratory: false,
    requirementRu: null,
  };

  it("оснащение названо тем, чего работа требует: лаборатория или походные инструменты", () => {
    expect(researchNeedsRu(plan).at(-1)?.valueRu).toBe("профильные походные инструменты");
    expect(researchNeedsRu({ ...plan, laboratory: true }).at(-1)?.valueRu).toBe(
      "профильная стационарная лаборатория",
    );
  });

  it("порции названы исходом, а расходники — своей ценой", () => {
    expect(researchNeedsRu({ ...plan, portionsOnSuccess: 0 })[1]?.valueRu).toBe(
      "2 порции только при провале",
    );
    expect(
      researchNeedsRu({ ...plan, consumablesRu: "Реактивы", consumablesGold: 5 })[2]?.valueRu,
    ).toBe("реактивы, 5 зм");
  });
});
