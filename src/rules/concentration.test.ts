import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";
import { createThorne } from "@/data/content/thorne/character";
import type { ActiveEffect } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";

import { RulesError } from "./abilities";
import {
  checkGuidanceRu,
  concentrationCheckDc,
  describeConcentration,
  describeConcentrationCheck,
  durationWithRoundsRu,
  startRound,
} from "./concentration";

/**
 * Карточка по идентификатору прямо из контента.
 *
 * Помощник `spell` из `@/testing/stores` здесь не годится: он тянет `@testing-library/react`, а
 * тесты правил идут в окружении node без jsdom.
 */
const CONTENT = new Map(loadThorneSpells().map((item) => [item.id, item]));

function spell(id: string): Spell {
  const found = CONTENT.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/**
 * Карточка без области.
 *
 * Ключ убирается, а не присваивается `undefined`: при `exactOptionalPropertyTypes` явный `undefined`
 * в необязательное поле не проходит проверку типов.
 */
function withoutArea(id: string): Omit<Spell, "area"> {
  const { area: _area, ...rest } = spell(id);
  return rest;
}

describe("concentrationCheckDc", () => {
  // Таблица из docs/rules-engine.md — граница проходит между 21 и 22.
  it.each([
    [0, 10],
    [1, 10],
    [12, 10],
    [19, 10],
    [20, 10],
    [21, 10],
    [22, 11],
    [23, 11],
    [40, 20],
    [99, 49],
  ])("урон %i даёт КС %i", (damage, expected) => {
    expect(concentrationCheckDc(damage)).toBe(expected);
  });

  it.each([-1, 3.5, Number.NaN])("отклоняет недопустимый урон %s", (damage) => {
    expect(() => concentrationCheckDc(damage)).toThrow(RulesError);
  });
});

describe("describeConcentrationCheck", () => {
  it("описывает спасбросок Телосложения с КС и модификатором", () => {
    expect(describeConcentrationCheck(30, 2)).toEqual({
      ability: "CON",
      dc: 15,
      modifier: 2,
      hasAdvantage: false,
      minimumRoll: 13,
    });
  });

  it("отмечает преимущество от «Боевого заклинателя»", () => {
    expect(describeConcentrationCheck(10, -1, { hasAdvantage: true })).toEqual({
      ability: "CON",
      dc: 10,
      modifier: -1,
      hasAdvantage: true,
      minimumRoll: 11,
    });
  });

  it("отклоняет нецелый модификатор", () => {
    expect(() => describeConcentrationCheck(10, 1.5)).toThrow(RulesError);
  });

  it("считает наименьший проходящий бросок", () => {
    expect(describeConcentrationCheck(24, 4).minimumRoll).toBe(8);
    expect(describeConcentrationCheck(10, -1).minimumRoll).toBe(11);
  });
});

describe("checkGuidanceRu", () => {
  it("называет наименьший проходящий бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4))).toBe("Бросьте d20, нужно 8 и выше");
  });

  it("предупреждает о преимуществе", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4, { hasAdvantage: true }))).toBe(
      "Бросьте d20 с преимуществом, нужно 8 и выше",
    );
  });

  it("говорит, что проходит любой бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(10, 9))).toBe("Проходит любой бросок d20");
  });

  it("говорит, что бросок не спасёт", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(60, 4))).toBe(
      "Не проходит даже 20: концентрация держится только руной",
    );
  });
});

describe("startRound", () => {
  const marks = [
    { at: "2026-07-31T18:00:00.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" },
    { at: "2026-07-31T18:00:02.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:03.000Z", kind: "turn_started" },
  ];

  it("считает начавшиеся ходы до времени начала эффекта", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.500Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("учитывает ход, начавшийся тем же мгновением", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.000Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("даёт первый раунд, пока ни один ход не отмечен", () => {
    expect(startRound([{ at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" }], "2026-07-31T18:00:01.000Z")).toEqual({
      round: 1,
      approximate: false,
    });
  });

  it("помечает число неточным, если начало вытеснено из журнала", () => {
    expect(startRound(marks, "2026-07-31T17:00:00.000Z")).toEqual({
      round: 1,
      approximate: true,
    });
  });

  it("помечает число неточным при пустом журнале: состояние импортировано", () => {
    expect(startRound([], "2026-07-31T18:00:00.000Z")).toEqual({ round: 1, approximate: true });
  });
});

describe("durationWithRoundsRu", () => {
  // Предлог «до» требует родительного падежа: «до 3 раунда» читается как ошибка приложения.
  it.each([
    [{ type: "rounds", value: 3 } as const, "до 3 раундов"],
    [{ type: "rounds", value: 1 } as const, "до 1 раунда"],
    // Перевод в раунды помогает, пока их можно пересчитать в уме и сравнить с длиной боя.
    [{ type: "minutes", value: 1 } as const, "до 1 минуты (10 раундов)"],
    [{ type: "minutes", value: 10 } as const, "до 10 минут"],
    [{ type: "hours", value: 1 } as const, "до 1 часа"],
    [{ type: "special" } as const, "особая длительность"],
    [{ type: "minutes" } as const, "до 0 минут (0 раундов)"],
  ])("%o читается как «%s»", (duration, expected) => {
    expect(durationWithRoundsRu(duration)).toBe(expected);
  });
});

describe("describeConcentration (FR-084)", () => {
  const journal = [
    { at: "2026-07-31T18:00:00.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" },
  ];

  function effect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
    return {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      type: "control",
      startedAt: "2026-07-31T18:00:01.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
      ...overrides,
    };
  }

  function summaryFor(spellId: string, overrides: Partial<ActiveEffect> = {}) {
    return describeConcentration({
      spell: spell(spellId),
      effect: effect({ spellId, ...overrides }),
      character: createThorne(),
      journal,
    });
  }

  it("описывает заклинание с областью и без спасброска", () => {
    const summary = summaryFor("detect-magic");

    expect(summary.spellId).toBe("detect-magic");
    expect(summary.rulesAvailable).toBe(true);
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.slotLabel).toBe("ячейка 1 ур.");
    expect(summary.startLabel).toBe("раунд 1");
    expect(summary.durationLabel).toBe("до 10 минут");
    expect(summary.mechanicsLabel).toBe("Сфера 30 футов от себя · без спасброска");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения +4, КС от 10");
    expect(summary.shortRulesRu).toContain("чувствует магию");
  });

  it("подставляет КС спасброска цели", () => {
    const summary = describeConcentration({
      spell: { ...withoutArea("detect-magic"), resolution: { type: "saving_throw", savingThrow: "DEX" } },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toBe("На себя · спасбросок Ловкости против КС 16");
  });

  it("подставляет модификатор атаки и урон по фактической ячейке", () => {
    const summary = describeConcentration({
      spell: { ...spell("ray-of-frost"), concentration: true, duration: { type: "rounds", value: 3 } },
      effect: effect({ spellId: "ray-of-frost", slotLevelUsed: 0, duration: { type: "rounds", value: 3 } }),
      character: createThorne(),
      journal,
    });

    expect(summary.slotLabel).toBe("без ячейки");
    expect(summary.durationLabel).toBe("до 3 раундов");
    // Заговор растёт от уровня персонажа: пороги 5 и 11, у 7 уровня — два кубика.
    expect(summary.mechanicsLabel).toBe("60 футов · атака заклинанием +8 · урон 2d8 (холод)");
  });

  it("помечает раунд неточным, если начало вытеснено из журнала", () => {
    const summary = describeConcentration({
      spell: spell("detect-magic"),
      effect: effect({ startedAt: "2026-07-31T10:00:00.000Z" }),
      character: createThorne(),
      journal,
    });

    expect(summary.startLabel).toBe("раунд ≥ 1");
  });

  it("перечисляет способы прерывания, помечая право мастера", () => {
    const { breakers } = summaryFor("detect-magic");

    expect(breakers[0]?.textRu).toContain("спасбросок Телосложения +4");
    expect(breakers.map((breaker) => breaker.atDiscretion)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(breakers.at(-1)?.textRu).toContain("КС 10");
  });

  it("деградирует до данных эффекта, если карточки нет в контенте", () => {
    const summary = describeConcentration({
      spell: null,
      effect: effect(),
      character: createThorne(),
      journal,
    });

    // Показать «Концентрации нет» нельзя: незаметная потеря концентрации запрещена.
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.rulesAvailable).toBe(false);
    expect(summary.mechanicsLabel).toBe("Правил нет в контенте: состояние из другой сборки");
    expect(summary.shortRulesRu).toBe("До конца концентрации или истечения длительности.");
    expect(summary.breakers).toHaveLength(6);
  });

  it("называет Телосложение, когда спасбросок в карточке не указан", () => {
    const summary = describeConcentration({
      spell: { ...withoutArea("detect-magic"), resolution: { type: "saving_throw" } },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    // Подстановка по умолчанию: концентрацию срывает спасбросок Телосложения.
    expect(summary.mechanicsLabel).toBe("На себя · спасбросок Телосложения против КС 16");
  });

  it("показывает отрицательные модификаторы со знаком минус", () => {
    // Волшебник со штрафом: у Торна оба модификатора положительные, а знак обязан быть верным.
    const character = { ...createThorne(), spellAttackModifier: -1, constitutionSaveModifier: -2 };
    const summary = describeConcentration({
      spell: spell("ray-of-frost"),
      effect: effect({ spellId: "ray-of-frost", slotLevelUsed: 0 }),
      character,
      journal,
    });

    expect(summary.mechanicsLabel).toContain("атака заклинанием -1");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения -2, КС от 10");
  });

  it.each([
    [{ type: "touch" } as const, "Касание"],
    [{ type: "special" } as const, "Особая дальность"],
    [{ type: "distance" } as const, "0 футов"],
  ])("описывает дальность %o как «%s»", (range, expected) => {
    const summary = describeConcentration({
      spell: { ...withoutArea("detect-magic"), range },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toContain(expected);
  });

  it.each([
    ["cone" as const, "Конус"],
    ["cube" as const, "Куб"],
    ["line" as const, "Линия"],
    ["cylinder" as const, "Цилиндр"],
  ])("называет область формы %s как «%s»", (shape, expected) => {
    const summary = describeConcentration({
      spell: {
        ...spell("detect-magic"),
        area: { shape, sizeFeet: 20 },
        range: { type: "distance", distanceFeet: 60 },
      },
      effect: effect(),
      character: createThorne(),
      journal,
    });

    expect(summary.mechanicsLabel).toContain(`${expected} 20 футов`);
  });
});
