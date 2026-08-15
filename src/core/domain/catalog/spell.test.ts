import { describe, expect, it } from "vitest";

import { fieldsOf } from "@/core/domain/shared/fields";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";

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
  const draft = fieldsOf(structuredClone(base));
  change(draft);
  return draft;
}

/**
 * Правка вложенного слоя карточки: слой читается полями и возвращается на место целиком — правка
 * копии, оставленной без присваивания, до заклинания бы не дошла.
 */
function mutateLayer(
  base: unknown,
  key: string,
  change: (layer: Record<string, unknown>) => void,
): unknown {
  return mutate(base, (draft) => {
    const layer = fieldsOf(draft[key]);
    change(layer);
    draft[key] = layer;
  });
}

const withRoleplay = (change: (roleplay: Record<string, unknown>) => void): unknown =>
  mutateLayer(web(), "roleplay", change);

const withDiagram = (change: (diagram: Record<string, unknown>) => void): unknown =>
  mutateLayer(ritualCard(), "ritualDiagram", change);

/** Заготовка ритуального заклинания со схемой: минимальный набор слоёв. */
function ritualCard(): unknown {
  return mutate(web(), (draft) => {
    draft.ritual = true;
    draft.concentration = false;
    draft.ritualDiagram = {
      rings: [1, 0.7],
      centralSeal: { kind: "eye", radius: 0.3 },
      captionRu: "Двойное кольцо и глаз в центре",
    };
  });
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

  it("длительность без числа отвергается", () => {
    for (const duration of [{ type: "rounds" }, { type: "minutes" }, { type: "hours" }]) {
      expect(firstError(mutate(web(), (draft) => { draft.duration = duration; })))
        .toContain("обязана указывать число");
    }
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
        withRoleplay((roleplay) => {
          roleplay.completeVariants = { short: ["Один."], atmospheric: [], sarcastic: [] };
        }),
      ),
    ).toContain("минимум 3 варианта");
  });

  it("отклоняет пустую реплику", () => {
    expect(
      spellSchema.safeParse(
        withRoleplay((roleplay) => {
          roleplay.incantation = "   ";
        }),
      ).success,
    ).toBe(false);
  });

  it("отклоняет список реплик: реплика ровно одна (FR-050)", () => {
    expect(
      spellSchema.safeParse(
        withRoleplay((roleplay) => {
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

describe("схема ритуала (FR-190, FR-191)", () => {
  it("принимает ритуал со схемой", () => {
    expect(spellSchema.safeParse(ritualCard()).success).toBe(true);
  });

  it("отклоняет ритуал без схемы", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          delete draft.ritualDiagram;
        }),
      ),
    ).toContain("Ритуальное заклинание обязано иметь схему");
  });

  it("отклоняет схему у неритуального заклинания", () => {
    expect(
      firstError(
        mutate(ritualCard(), (draft) => {
          draft.ritual = false;
        }),
      ),
    ).toContain("Схема ритуала есть только у ритуального заклинания");
  });

  it("отклоняет кольца не по убыванию", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.rings = [0.7, 1];
        }),
      ),
    ).toContain("Кольца перечисляются снаружи внутрь");
  });

  it("отклоняет внешнее кольцо меньше единицы", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.rings = [0.9, 0.5];
        }),
      ),
    ).toContain("Внешнее кольцо равно 1");
  });

  it("отклоняет skip, не дающий звезды", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.star = { points: 6, skip: 3, radius: 0.6 };
        }),
      ),
    ).toContain("Шаг звезды");
  });

  it("отклоняет число знаков, не равное числу вершин на том же радиусе", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.star = { points: 7, skip: 3, radius: 0.6 };
          diagram.radialGlyphs = { glyphs: ["sun", "moon", "mars"], radius: 0.6 };
        }),
      ),
    ).toContain("Знаки стоят на вершинах звезды");
  });

  it("принимает знаки на своём радиусе без звезды", () => {
    const withGlyphs = withDiagram((diagram) => {
   diagram.radialGlyphs = { glyphs: ["sun", "moon", "mars", "venus"], radius: 0.6 };
 });
    expect(spellSchema.safeParse(withGlyphs).success).toBe(true);
  });

  it("отклоняет неизвестный знак", () => {
    expect(
      spellSchema.safeParse(
        withDiagram((diagram) => {
          diagram.radialGlyphs = { glyphs: ["sun", "moon", "phlogiston"], radius: 0.6 };
        }),
      ).success,
    ).toBe(false);
  });

  it("отклоняет надпись с символом вне футарка", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.inscription = { runes: "ᚨжᚢ", meaningRu: "проверка", radius: 0.9 };
        }),
      ),
    ).toContain("не руна старшего футарка");
  });

  it("принимает надпись из рун", () => {
    const withInscription = withDiagram((diagram) => {
   diagram.inscription = { runes: "ᚨᛚᚢ", meaningRu: "«алу» — освящение", radius: 0.9 };
 });
    expect(spellSchema.safeParse(withInscription).success).toBe(true);
  });

  it("отклоняет немагический числовой квадрат", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.magicSquare = { rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], radius: 0.44 };
          diagram.centralSeal = { kind: "eye", radius: 0.14 };
        }),
      ),
    ).toContain("Квадрат не магический");
  });

  it("принимает квадрат Сатурна", () => {
    const withSquare = withDiagram((diagram) => {
   diagram.magicSquare = { rows: [[4, 9, 2], [3, 5, 7], [8, 1, 6]], radius: 0.44 };
   diagram.centralSeal = { kind: "eye", radius: 0.14 };
 });
    expect(spellSchema.safeParse(withSquare).success).toBe(true);
  });

  it("отклоняет печать, не влезающую в центральную клетку квадрата", () => {
    expect(
      firstError(
        withDiagram((diagram) => {
          diagram.magicSquare = { rows: [[4, 9, 2], [3, 5, 7], [8, 1, 6]], radius: 0.44 };
          diagram.centralSeal = { kind: "eye", radius: 0.4 };
        }),
      ),
    ).toContain("Печать не помещается");
  });

  it("отклоняет угловые знаки числом, отличным от четырёх", () => {
    expect(
      spellSchema.safeParse(
        withDiagram((diagram) => {
          diagram.cornerMarks = ["air", "water", "earth"];
        }),
      ).success,
    ).toBe(false);
  });
});

describe("расход костей хитов (FR-135)", () => {
  it("заклинание с расходом костей принимается", () => {
    const result = spellSchema.safeParse(
      mutate(web(), (draft) => {
        draft.hitDiceCost = {
          maximumDice: 2,
          extraDicePerSlotLevel: 2,
          addsSpellcastingModifier: true,
        };
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed: Spell = result.data;
      expect(parsed.hitDiceCost?.maximumDice).toBe(2);
    }
  });

  it("заклинание без поля остаётся корректным: поле необязательное ради импорта (ADR-0004)", () => {
    expect(spellSchema.safeParse(web()).success).toBe(true);
  });

  it("ноль костей отклоняется: расход, ничего не расходующий, — ошибка контента", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.hitDiceCost = {
            maximumDice: 0,
            extraDicePerSlotLevel: 0,
            addsSpellcastingModifier: false,
          };
        }),
      ),
    ).toBeTruthy();
  });

  it("отрицательный рост от ячейки отклоняется", () => {
    expect(
      firstError(
        mutate(web(), (draft) => {
          draft.hitDiceCost = {
            maximumDice: 2,
            extraDicePerSlotLevel: -1,
            addsSpellcastingModifier: true,
          };
        }),
      ),
    ).toBeTruthy();
  });
});

describe("вклады заклинания (FR-093)", () => {
  const withContribution = (contribution: unknown): unknown => ({
    ...fieldsOf(web()),
    contributions: [contribution],
  });
  const bonus = (value: number) => withContribution({ stat: "armorClass", kind: "bonus", value });

  it("вклада нет вовсе — заклинание на числа не влияет", () => {
    expect(spellSchema.safeParse(fieldsOf(web())).success).toBe(true);
  });

  it("нулевой и отрицательный вклад карточкой не приходят: это поправка мастера", () => {
    expect(firstError(bonus(0))).toContain("не бывает нулевым или отрицательным");
    expect(firstError(bonus(-1))).toContain("не бывает нулевым или отрицательным");
  });

  it("отказ называет заклинание по имени", () => {
    expect(firstError(bonus(-1))).toContain("Паутина");
  });

  it("вклад называет величину словаря, и выдуманной величины не бывает", () => {
    expect(spellSchema.safeParse(bonus(2)).success).toBe(true);
    expect(
      spellSchema.safeParse(withContribution({ stat: "лихость", kind: "bonus", value: 2 })).success,
    ).toBe(false);
  });

  it("способ счёта от заклинания несёт базу: «Доспехи мага» спорят с доспехом, а не прибавляются", () => {
    expect(
      spellSchema.safeParse(
        withContribution({
          stat: "armorClass",
          kind: "method",
          method: { family: "spell", base: 13 },
        }),
      ).success,
    ).toBe(true);
  });
});
