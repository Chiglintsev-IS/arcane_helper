/**
 * Подписи блока концентрации.
 *
 * Числа сюда приходят проекцией, и здесь проверяется только выбор слов: падеж, знак, порядок фактов
 * через точку и деградация без карточки. Правила — раунд начала, урон по ячейке, сложность — стоят
 * у своего владельца и проверяются его прогоном.
 */

import { describe, expect, it } from "vitest";

import type { ConcentrationView, SpellRowView } from "@/contract/views";
import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { testSnapshot, testSpellRow } from "@/ui/app/testing/stores";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";

/** Числа заклинателя Торна: их строит настоящий презентер. */
const CASTING = testSnapshot().casting;

/** Строка настоящей проекции: досягаемость и род броска блок берёт из неё. */
const ROW = testSpellRow("detect-magic");

function concentration(overrides: Partial<ConcentrationView> = {}): ConcentrationView {
  return {
    spellId: "detect-magic",
    nameRu: "Обнаружение магии",
    slotLevelUsed: 1,
    startedOnRound: 1,
    startApproximate: false,
    durationRu: "до 10 минут",
    shortRulesRu: "Заклинатель чувствует присутствие магии вокруг себя.",
    save: 4,
    minimumDc: 10,
    ...overrides,
  };
}

function summaryOf(
  overrides: Partial<ConcentrationView> = {},
  row: SpellRowView | null = ROW,
  casting = CASTING,
) {
  return describeConcentration({ concentration: concentration(overrides), row, casting });
}

describe("describeConcentration (FR-084)", () => {
  it("описывает заклинание с областью и без броска", () => {
    const summary = summaryOf();

    expect(summary.spellId).toBe("detect-magic");
    expect(summary.rulesAvailable).toBe(true);
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.slotLabel).toBe("ячейка 1 ур.");
    expect(summary.startLabel).toBe("раунд 1");
    expect(summary.durationLabel).toBe("до 10 минут");
    expect(summary.mechanicsLabel).toBe("Сфера 30 футов от себя · Без броска");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения +4, КС от 10");
    expect(summary.shortRulesRu).toContain("чувствует присутствие магии");
  });

  it("подставляет КС спасброска цели", () => {
    const { area: _area, ...withoutArea } = ROW;
    const summary = summaryOf({}, {
      ...withoutArea,
      resolution: { type: "saving_throw", savingThrow: "DEX" },
    });

    expect(summary.mechanicsLabel).toBe("На себя · Спасбросок Ловкости КС 16");
  });

  it("подставляет модификатор атаки и урон, посчитанный проекцией", () => {
    const summary = summaryOf(
      { slotLevelUsed: 0, damage: { formula: "2d8", type: "холод" } },
      testSpellRow("ray-of-frost"),
    );

    expect(summary.slotLabel).toBe("без ячейки");
    expect(summary.mechanicsLabel).toBe("60 футов · Атака d20+8 · Урон 2d8 (холод)");
  });

  it("помечает раунд неточным, если начало вытеснено из журнала", () => {
    expect(summaryOf({ startApproximate: true }).startLabel).toBe("раунд ≥ 1");
  });

  it("перечисляет способы прерывания, помечая право мастера", () => {
    const { breakers } = summaryOf();

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
    const { spellId: _spellId, ...withoutCard } = concentration({
      shortRulesRu: "До конца концентрации или истечения длительности.",
    });
    const summary = describeConcentration({ concentration: withoutCard, row: null, casting: CASTING });

    // Показать «Концентрации нет» нельзя: незаметная потеря концентрации запрещена.
    expect(summary.nameRu).toBe("Обнаружение магии");
    expect(summary.rulesAvailable).toBe(false);
    expect(summary.mechanicsLabel).toBe("Правил нет в контенте: состояние из другой сборки");
    expect(summary.shortRulesRu).toBe("До конца концентрации или истечения длительности.");
    expect(summary.breakers).toHaveLength(6);
  });

  it("не выдумывает характеристику, когда спасбросок в карточке не указан", () => {
    const { area: _area, ...withoutArea } = ROW;
    const summary = summaryOf({}, { ...withoutArea, resolution: { type: "saving_throw" } });

    // Схема требует характеристику при спасброске; без неё состояние испорчено, и назвать один
    // порог честнее, чем выдумать характеристику.
    expect(summary.mechanicsLabel).toBe("На себя · Спасбросок КС 16");
  });

  it("показывает отрицательные модификаторы со знаком минус", () => {
    // Волшебник со штрафом: у Торна оба модификатора положительные, а знак обязан быть верным.
    const base = createThorne();
    const character: CharacterState = {
      ...base,
      activeEffects: [
        {
          id: "curse",
          nameRu: "Проклятие",
          startedAt: "2026-08-08T00:00:00.000Z",
          duration: { type: "special" },
          isConcentration: false,
          slotLevelUsed: 0,
          endConditionRu: "Пока мастер не снимет.",
          contributions: [
            { stat: "spellAttackModifier", kind: "bonus", value: -9 },
            { stat: "save:constitution", kind: "bonus", value: -6 },
          ],
        },
      ],
    };
    const summary = summaryOf(
      { save: -2, slotLevelUsed: 0 },
      testSpellRow("ray-of-frost", character),
      // Числа проклятого заклинателя: их считает та же проекция, что и в приложении.
      testSnapshot(character).casting,
    );

    expect(summary.mechanicsLabel).toContain("Атака d20−1");
    expect(summary.breakLabel).toBe("Урон → спасбросок Телосложения −2, КС от 10");
  });

  it.each([
    [{ type: "touch" } as const, "Касание"],
    [{ type: "special" } as const, "Особая дальность"],
    [{ type: "distance" } as const, "0 футов"],
  ])("описывает дальность %o как «%s»", (range, expected) => {
    const { area: _area, ...withoutArea } = ROW;

    expect(summaryOf({}, { ...withoutArea, range }).mechanicsLabel).toContain(expected);
  });

  it.each([
    ["cone", "Конус"],
    ["cube", "Куб"],
    ["line", "Линия"],
    ["cylinder", "Цилиндр"],
  ])("называет область формы %s как «%s»", (shape, expected) => {
    const summary = summaryOf({}, {
      ...ROW,
      area: { shape, sizeFeet: 20 },
      range: { type: "distance", distanceFeet: 60 },
    });

    expect(summary.mechanicsLabel).toContain(`${expected} 20 футов`);
  });
});
