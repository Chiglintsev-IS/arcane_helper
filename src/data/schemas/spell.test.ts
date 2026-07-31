import { describe, expect, it } from "vitest";

import { spellSchema, type Spell } from "./spell";

/** Заготовка «Паутины»: концентрация, куб, спасбросок Ловкости, повторяемое действие. */
function web(): unknown {
  return {
    id: "web",
    nameRu: "Паутина",
    nameEn: "Web",
    level: 2,
    school: "Вызов",
    castingTime: { type: "action" },
    range: { type: "distance", distanceFeet: 60 },
    area: { shape: "cube", sizeFeet: 20 },
    components: { verbal: true, somatic: true, material: true, materialText: "щепотка паутины" },
    duration: { type: "hours", value: 1 },
    concentration: true,
    ritual: false,
    targeting: { type: "point" },
    resolution: {
      type: "saving_throw",
      savingThrow: "DEX",
      successEffect: "существо не опутано",
      failureEffect: "существо опутано",
    },
    shortRulesRu: "Заполняет куб 20 футов паутиной, опутывая провалившихся.",
    fullRulesRu: "Собственный пересказ механики заклинания.",
    tacticalAdviceRu: "Удобно против группы противников в узком проходе.",
    roleplay: {
      incantation: "Стой.",
      gesture: "Чертит мелом знак связи.",
      visualEffect: "Из воздуха проступают ледяные нити.",
      completeVariants: {
        short: ["Чертит знак — проход зарастает нитями."],
        atmospheric: ["Воздух густеет, и между камнями прорастает морозная сеть."],
        sarcastic: ["Торн вздыхает: «Опять придётся всё делать самому»."],
      },
    },
    announcementTemplate:
      "Использую действие и сотворяю «Паутину» ячейкой {slotLevel} уровня. Спасбросок Ловкости против КС {spellSaveDc}.",
  };
}

/** Заготовка «Луча холода»: заговор с масштабированием от уровня персонажа. */
function rayOfFrost(): unknown {
  return {
    id: "ray-of-frost",
    nameRu: "Луч холода",
    nameEn: "Ray of Frost",
    level: 0,
    school: "Воплощение",
    castingTime: { type: "action" },
    range: { type: "distance", distanceFeet: 60 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: "instant" },
    concentration: false,
    ritual: false,
    targeting: { type: "creature", maximumTargets: 1 },
    resolution: { type: "spell_attack" },
    damage: { dice: "1d8", type: "холод", scaling: { 5: "2d8", 11: "3d8", 17: "4d8" } },
    shortRulesRu: "Луч холода наносит урон и снижает скорость цели на 10 футов.",
    fullRulesRu: "Собственный пересказ механики заклинания.",
    roleplay: {
      incantation: "Холодно.",
      gesture: "Ведёт пальцем короткую руну.",
      visualEffect: "Тонкий белый луч оставляет иней на камне.",
      completeVariants: {
        short: ["Короткий взмах — и по цели проходит изморозь."],
        atmospheric: ["Руна на пальце вспыхивает синим, воздух звенит от холода."],
        sarcastic: ["«Остынь», — советует Торн."],
      },
    },
    announcementTemplate: "Атака заклинанием, модификатор {spellAttackModifier}. Урон {damage} холодом.",
  };
}

function mutate(base: unknown, change: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(base) as Record<string, unknown>;
  change(draft);
  return draft;
}

function firstError(input: unknown): string {
  const result = spellSchema.safeParse(input);
  expect(result.success, "ожидалась ошибка валидации").toBe(false);
  return result.success ? "" : result.error.issues.map((issue) => issue.message).join(" | ");
}

describe("spellSchema принимает корректные заклинания", () => {
  it("заклинание со спасброском и областью", () => {
    const result = spellSchema.safeParse(web());
    expect(result.success).toBe(true);
  });

  it("заговор с масштабированием от уровня персонажа", () => {
    const result = spellSchema.safeParse(rayOfFrost());
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed: Spell = result.data;
      expect(parsed.damage?.scaling?.[5]).toBe("2d8");
    }
  });
});

describe("обязательные связи полей", () => {
  it("реакция без триггера отклоняется", () => {
    expect(firstError(mutate(web(), (draft) => { draft.castingTime = { type: "reaction" }; })))
      .toContain("триггер");
  });

  it("реакция с триггером принимается", () => {
    const withTrigger = mutate(web(), (draft) => {
      draft.castingTime = { type: "reaction", reactionTrigger: "в вас попали атакой" };
    });
    expect(spellSchema.safeParse(withTrigger).success).toBe(true);
  });

  it("накладывание в минутах без числа отклоняется (FR-033)", () => {
    expect(firstError(mutate(web(), (draft) => { draft.castingTime = { type: "minute" }; })))
      .toContain("обязано указывать число");
  });

  it("накладывание с числом принимается: 1 минута и 1 час", () => {
    for (const castingTime of [{ type: "minute", value: 1 }, { type: "hour", value: 1 }]) {
      const withValue = mutate(web(), (draft) => { draft.castingTime = castingTime; });
      expect(spellSchema.safeParse(withValue).success).toBe(true);
    }
  });

  it("число при накладывании действием отклоняется: «1 действие» смысла не имеет", () => {
    expect(firstError(mutate(web(), (draft) => { draft.castingTime = { type: "action", value: 1 }; })))
      .toContain("не относится");
  });

  it("дальность «distance» без расстояния отклоняется", () => {
    expect(firstError(mutate(web(), (draft) => { draft.range = { type: "distance" }; })))
      .toContain("расстояние");
  });

  it("материальный компонент без описания отклоняется", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.components = { verbal: true, somatic: true, material: true };
        }),
      ),
    ).toContain("Материальный компонент");
  });

  it("спасбросок без характеристики отклоняется", () => {
    expect(firstError(mutate(web(), (draft) => { draft.resolution = { type: "saving_throw" }; })))
      .toContain("характеристику спасброска");
  });

  it("уровень вне диапазона 0…9 отклоняется", () => {
    expect(spellSchema.safeParse(mutate(web(), (draft) => { draft.level = 10; })).success).toBe(false);
  });
});

describe("инварианты заговора", () => {
  it("заговор не может быть ритуальным", () => {
    expect(firstError(mutate(rayOfFrost(), (draft) => { draft.ritual = true; })))
      .toContain("Заговор не может быть ритуальным");
  });

  it("порог уровня персонажа вне 1…20 отклоняется", () => {
    expect(
      firstError(
        mutate(rayOfFrost(), (draft) => {
          draft.damage = { dice: "1d8", type: "холод", scaling: { 25: "5d8" } };
        }),
      ),
    ).toContain("Порог уровня персонажа");
  });
});

describe("масштабирование заклинаний уровня 1 и выше", () => {
  it("принимает ключи от уровня заклинания и выше", () => {
    const scaled = mutate(web(), (draft) => {
      draft.damage = { dice: "2d6", type: "холод", scaling: { 3: "3d6", 4: "4d6" } };
    });
    expect(spellSchema.safeParse(scaled).success).toBe(true);
  });

  it("отклоняет ключ ниже уровня заклинания", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.damage = { dice: "2d6", type: "холод", scaling: { 1: "1d6" } };
        }),
      ),
    ).toContain("вне диапазона 2…9");
  });
});

describe("минимум художественного контента (FR-050)", () => {
  it("отклоняет менее трёх вариантов отыгрыша", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          const roleplay = draft.roleplay as Record<string, unknown>;
          roleplay.completeVariants = { short: ["Один."], atmospheric: [], sarcastic: [] };
        }),
      ),
    ).toContain("минимум 3 варианта");
  });

  it("отклоняет пустую реплику", () => {
    expect(
      spellSchema.safeParse(
        mutate(web(), (draft) => {
          const roleplay = draft.roleplay as Record<string, unknown>;
          roleplay.incantation = "   ";
        }),
      ).success,
    ).toBe(false);
  });

  it("отклоняет список реплик: реплика ровно одна (FR-050)", () => {
    expect(
      spellSchema.safeParse(
        mutate(web(), (draft) => {
          const roleplay = draft.roleplay as Record<string, unknown>;
          roleplay.incantation = ["Стой.", "Холодно."];
        }),
      ).success,
    ).toBe(false);
  });
});

describe("подстановки объявления (FR-041)", () => {
  it("отклоняет подстановку вне закрытого словаря", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.announcementTemplate = "Сотворяю «Паутину» ячейкой {slotLevel}, урон {fireDamage}.";
        }),
      ),
    ).toContain("Неизвестная подстановка «{fireDamage}»");
  });

  it("принимает шаблон вовсе без подстановок", () => {
    const plain = mutate(web(), (draft) => {
      draft.announcementTemplate = "Сотворяю «Паутину» и выбираю точку в пределах дальности.";
    });
    expect(spellSchema.safeParse(plain).success).toBe(true);
  });
});

describe("чистота технической формулировки (FR-042)", () => {
  it("отклоняет объявление с художественным текстом", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.announcementTemplate = "Сотворяю «Паутину». Стой.";
        }),
      ),
    ).toContain("художественный текст");
  });
});
