import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { ActiveEffect } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";

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
    expect(summary.shortRulesRu).toContain("чувствует присутствие магии");
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
    const base = createThorne();
    const character = {
      ...base,
      overrides: { ...base.overrides, spellAttackModifier: -1, saves: { constitution: -2 } },
    };
    const summary = describeConcentration({
      spell: spell("ray-of-frost"),
      effect: effect({ spellId: "ray-of-frost", slotLevelUsed: 0 }),
      character,
      journal,
    });

    expect(summary.mechanicsLabel).toContain("атака заклинанием −1");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения −2, КС от 10");
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
