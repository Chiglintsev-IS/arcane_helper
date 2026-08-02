import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import {
  castingTimeLabel,
  castingTimePhrase,
  durationPhrase,
  ritualOnlyBadge,
  resolutionBadge,
} from "./format";

/** Числа Торна: оба включают +1 от предмета, и книга их не знает. */
const THORNE = { spellSaveDc: 16, spellAttackModifier: 8 };

describe("castingTimeLabel (FR-033)", () => {
  it("действие, бонусное действие и реакция называются словом", () => {
    expect(castingTimeLabel({ type: "action" })).toBe("Действие");
    expect(castingTimeLabel({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimeLabel({ type: "reaction", reactionTrigger: "в вас попали" })).toBe("Реакция");
  });

  it("минуты и часы называются числом: «1 минута», а не «Минуты»", () => {
    expect(castingTimeLabel({ type: "minute", value: 1 })).toBe("1 минута");
    expect(castingTimeLabel({ type: "minute", value: 10 })).toBe("10 минут");
    expect(castingTimeLabel({ type: "hour", value: 1 })).toBe("1 час");
  });

  it("без числа остаётся категория: врать о времени хуже, чем назвать его приблизительно", () => {
    expect(castingTimeLabel({ type: "minute" })).toBe("Минуты");
  });
});

describe("castingTimePhrase (FR-014)", () => {
  it("действие, бонусное и реакция остаются одним словом: их не с чем спутать", () => {
    expect(castingTimePhrase({ type: "action" })).toBe("Действие");
    expect(castingTimePhrase({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimePhrase({ type: "reaction", reactionTrigger: "в вас попали" })).toBe("Реакция");
  });

  it("минуты и часы называют себя глаголом: «Накладывать», а не голое число", () => {
    expect(castingTimePhrase({ type: "minute", value: 1 })).toBe("Накладывать 1 минуту");
    expect(castingTimePhrase({ type: "minute", value: 10 })).toBe("Накладывать 10 минут");
    expect(castingTimePhrase({ type: "hour", value: 1 })).toBe("Накладывать 1 час");
  });

  it("без числа остаётся категория: врать о времени хуже, чем назвать приблизительно", () => {
    expect(castingTimePhrase({ type: "minute" })).toBe("Минуты");
  });
});

describe("durationPhrase (FR-014)", () => {
  it("мгновенная длительность названа эффектом, а не временем", () => {
    expect(durationPhrase({ type: "instant" })).toBe("Мгновенный эффект");
  });

  it("длящаяся называет себя глаголом и склоняется", () => {
    expect(durationPhrase({ type: "minutes", value: 1 })).toBe("Держится 1 минуту");
    expect(durationPhrase({ type: "minutes", value: 10 })).toBe("Держится 10 минут");
    expect(durationPhrase({ type: "hours", value: 1 })).toBe("Держится 1 час");
    expect(durationPhrase({ type: "rounds", value: 1 })).toBe("Держится 1 раунд");
  });

  it("особая длительность и длительность без числа названы особой", () => {
    expect(durationPhrase({ type: "special" })).toBe("Длительность особая");
    expect(durationPhrase({ type: "minutes" })).toBe("Длительность особая");
  });
});

describe("resolutionBadge (FR-211)", () => {
  it("атака называет бросок числом, а не словом «Атака»", () => {
    expect(resolutionBadge({ type: "spell_attack" }, THORNE).label).toBe("d20+8");
  });

  it("спасбросок называет и характеристику, и КС", () => {
    // В книге Торна спасбросковых заклинаний пока нет: значок проверяется на данных напрямую,
    // иначе он появится в приложении непроверенным вместе с первой карточкой 2 уровня.
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE).label).toBe(
      "Спасбросок Ловкости КС 16",
    );
  });

  it("числа берутся у персонажа, а не из книги", () => {
    const novice = { spellSaveDc: 13, spellAttackModifier: 5 };
    expect(resolutionBadge({ type: "spell_attack" }, novice).label).toBe("d20+5");
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "CON" }, novice).label).toBe(
      "Спасбросок Телосложения КС 13",
    );
  });

  it("без броска остаётся «Без броска»: числа тут нет и выдумывать его нечем", () => {
    expect(resolutionBadge({ type: "automatic" }, THORNE).label).toBe("Без броска");
  });
});

describe("ritualOnlyBadge (FR-219)", () => {
  const SPELLS = loadThorneSpells();
  const spell = (id: string) => SPELLS.find((candidate) => candidate.id === id)!;

  it("подготовленное значка не получает: рядом нажатая кнопка подготовки", () => {
    expect(ritualOnlyBadge(spell("mage-armor"), ["mage-armor"])).toBeNull();
  });

  it("неподготовленное — тоже: причину скажет строка недоступности словами", () => {
    expect(ritualOnlyBadge(spell("blink"), [])).toBeNull();
  });

  it("заговор значка не получает: цену он называет строкой «Без ячейки»", () => {
    expect(ritualOnlyBadge(spell("ray-of-frost"), [])).toBeNull();
  });

  it("неподготовленный ритуал остаётся: без подписи цена обещала бы ячейку", () => {
    // «Обнаружение магии» стоит «Ячейка 1 ур. или ритуал», но без подготовки способ один.
    expect(ritualOnlyBadge(spell("detect-magic"), [])?.label).toBe("Ритуал");
  });

  it("подготовленный ритуал молчит: ячейка ему доступна наравне с ритуалом", () => {
    expect(ritualOnlyBadge(spell("detect-magic"), ["detect-magic"])).toBeNull();
  });
});
