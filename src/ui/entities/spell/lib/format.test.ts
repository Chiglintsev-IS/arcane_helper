import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { testSnapshot, testSpellRow } from "@/ui/app/testing/stores";

import {
  castingTimeBadge,
  castingTimeLabel,
  castingTimePhrase,
  combatRole,
  durationPhrase,
  ritualOnlyBadge,
  targetingLabel,
  castingTimeDetail,
  durationDetail,
  castCostPhrase,
  rollPhrase,
} from "./format";

describe("castingTimeLabel (FR-033)", () => {
  it("действие, бонусное действие и реакция называются словом", () => {
    expect(castingTimeLabel({ type: "action" })).toBe("Действие");
    expect(castingTimeLabel({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimeLabel({ type: "reaction" })).toBe("Реакция");
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
    expect(castingTimePhrase({ type: "reaction" })).toBe("Реакция");
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

describe("castingTimeDetail и durationDetail (FR-014)", () => {
  it("ресурс хода назван вместе с тем, когда его тратят", () => {
    expect(castingTimeDetail({ type: "action" })).toBe("Действие — в свой ход");
    expect(castingTimeDetail({ type: "reaction" })).toBe("Реакция — в ответ, вне своего хода");
  });

  it("минуты переведены в раунды, часы остаются часами", () => {
    expect(castingTimeDetail({ type: "minute", value: 1 })).toBe("1 минута — 10 раундов");
    expect(castingTimeDetail({ type: "hour", value: 1 })).toBe("1 час");
    expect(durationDetail({ type: "minutes", value: 10 })).toBe("10 минут — 100 раундов");
    expect(durationDetail({ type: "hours", value: 8 })).toBe("8 часов");
  });

  it("один раунд объяснён ходом, мгновенное — эффектом сразу", () => {
    expect(durationDetail({ type: "rounds", value: 1 })).toBe("1 раунд — до начала своего следующего хода");
    expect(durationDetail({ type: "rounds", value: 3 })).toBe("3 раунда");
    expect(durationDetail({ type: "instant" })).toBe("Мгновенная — эффект сразу");
  });
});

describe("castCostPhrase и rollPhrase (FR-010, FR-211)", () => {
  const snapshot = testSnapshot(createThorne());
  const rowOf = (id: string) => {
    const found = snapshot.spells.find((row) => row.id === id);
    if (found === undefined) throw new Error(`нет строки ${id}`);
    return found;
  };

  it("подготовленный ритуал вне боя стоит «ячейка или ритуал»", () => {
    const prepared = { ...rowOf("alarm"), prepared: true, ritualAvailable: true, slotPrice: 1 };
    expect(castCostPhrase(prepared)).toBe("ячейка 1 или ◈ ритуал");
  });

  it("спасбросок без названной характеристики и без бросающего всё же назван", () => {
    const bare = { ...rowOf("web"), resolution: { type: "saving_throw" } };
    const { listCard: _dropped, ...withoutCard } = bare;
    expect(rollPhrase(withoutCard, snapshot.casting)).toBe("Цель бросает спасбросок против КС 16");
  });
});

describe("слово вне словаря значков", () => {
  // Договор ручается за непустую строку, а не за перечень, и тем же разбором читает снимок от
  // бэкенда, который вправе знать слов больше.
  it("время накладывания, которого словарь ещё не знает, показывается своим словом", () => {
    expect(castingTimeBadge("day")).toEqual({ label: "day", icon: "◷", tone: "muted" });
  });

  it("роль, которой словарь ещё не знает, читается как «ни то, ни другое»", () => {
    expect(combatRole("control")).toEqual(combatRole("other"));
  });
});

describe("targetingLabel", () => {
  it("предел числа целей назван числом: «Замедление» берёт шестерых", () => {
    expect(targetingLabel(testSpellRow("slow").card.targeting)).toBe("До 6 существ");
  });

  it("без предела цели названы несколькими: выдуманное число обещало бы правило", () => {
    // Предел необязателен у самих правил, и заклинание без него доезжает до карточки как есть.
    expect(targetingLabel({ type: "creatures" })).toBe("Несколько существ");
  });

  it("цель-предмет названа предметом: существом она не станет", () => {
    expect(targetingLabel(testSpellRow("mending").card.targeting)).toBe("Предмет");
  });

  it("точка в пространстве целью-существом не притворяется", () => {
    // Заклинания, целящегося в точку, в книге сейчас нет: проверяется слово, а не состав книги.
    expect(targetingLabel({ type: "point" })).toBe("Точка в пространстве");
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

describe("ritualOnlyBadge (FR-219)", () => {
  /** Строка заклинания у персонажа с ровно этим списком подготовленных. */
  const row = (id: string, ...prepared: string[]) =>
    testSpellRow(id, { ...createThorne(), preparedSpellIds: prepared });

  it("подготовленное значка не получает: рядом нажатая кнопка подготовки", () => {
    expect(ritualOnlyBadge(row("mage-armor", "mage-armor"))).toBeNull();
  });

  it("неподготовленное — тоже: причину скажет строка недоступности словами", () => {
    expect(ritualOnlyBadge(row("haste"))).toBeNull();
  });

  it("заговор значка не получает: цену он называет строкой «Без ячейки»", () => {
    expect(ritualOnlyBadge(row("ray-of-frost"))).toBeNull();
  });

  it("неподготовленный ритуал остаётся: без подписи цена обещала бы ячейку", () => {
    // «Обнаружение магии» стоит «Ячейка 1 ур. или ритуал», но без подготовки способ один.
    expect(ritualOnlyBadge(row("detect-magic"))?.label).toBe("Ритуал");
  });

  it("подготовленный ритуал молчит: ячейка ему доступна наравне с ритуалом", () => {
    expect(ritualOnlyBadge(row("detect-magic", "detect-magic"))).toBeNull();
  });
});
