import { describe, expect, it } from "vitest";

import {
  TIER_LABELS,
  directionTone,
  formulaAsideRu,
  goldPerHourRu,
  goldTotalRu,
  portionsRu,
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
    expect(directionTone("Трансмутация")).toBe("action");
    expect(directionTone(null)).toBe("muted");
    expect(directionTone("Кулинария")).toBe("bonus");
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
});
