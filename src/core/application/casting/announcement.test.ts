import type { CharacterState } from "@/core/domain/assembly/state";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  bloodExchangeAnnouncement,
  bloodExchangeInstructions,
  castInstructions,
  renderAnnouncement,
} from "@/core/application/casting/announcement";

/** Обстановка объявления: форму называет сама подпись, отдельного имени ей не нужно. */
type AnnouncementContext = Parameters<typeof renderAnnouncement>[1];

const allSpells = loadThorneSpells();
const spells = new Map(allSpells.map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

const thorne = createThorne();

function context(overrides: Partial<AnnouncementContext> = {}): AnnouncementContext {
  return { character: thorne, mode: "normal", payment: { kind: "none" }, ...overrides };
}

/** Проклятие мастера: у него есть окончание, значит это эффект, а не свойство Торна. */
const CURSE = {
  id: "curse",
  nameRu: "Проклятие",
  startedAt: "2026-08-08T00:00:00.000Z",
  duration: { type: "until_removed" },
  isConcentration: false,
  slotLevelUsed: 0,
  endConditionRu: "Пока мастер не снимет.",
} as const;

describe("renderAnnouncement: подстановки (FR-041)", () => {
  it("подставляет цель, дальность, модификатор атаки и урон заговора по уровню персонажа", () => {
    const announcement = renderAnnouncement(
      spell("ray-of-frost"),
      context({ mode: "cantrip", targetLabel: "гоблин у двери" }),
    );

    expect(announcement.text).toBe(
      "Использую действие и сотворяю «Луч холода» по цели гоблин у двери в пределах 60 футов." +
        " Атака заклинанием, модификатор +8. При попадании урон 2d8 холодом и скорость цели" +
        " снижается на 10 футов до начала моего следующего хода.",
    );
    expect(announcement.gaps).toEqual([]);
  });

  it("подставляет фактическую КС спасброска из состояния, а не базовую", () => {
    const announcement = renderAnnouncement(
      spell("disguise-self"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );
    // КС 16, а не 15: предмет добавляет +1.
    expect(announcement.text).toContain("против КС 16");
  });

  it("объявление берёт КС из характеристик, а не из хранимого числа", () => {
    const smarter = { ...thorne, abilities: { ...thorne.abilities, intelligence: 20 } };
    const announcement = renderAnnouncement(
      spell("disguise-self"),
      context({ character: smarter, payment: { kind: "slot", slotLevel: 1 } }),
    );
    expect(announcement.text).toContain("против КС 17");
  });

  it("сохраняет знак отрицательного модификатора атаки", () => {
    const cursed: CharacterState = {
      ...thorne,
      activeEffects: [
        {
          ...CURSE,
          contributions: [{ stat: "spellAttackModifier", kind: "bonus", value: -9 }],
        },
      ],
    };
    const announcement = renderAnnouncement(
      spell("ray-of-frost"),
      context({ character: cursed, mode: "cantrip", targetLabel: "гоблин" }),
    );
    expect(announcement.text).toContain("модификатор −1");
  });

  it("называет выбранный уровень ячейки при повышении", () => {
    const announcement = renderAnnouncement(
      spell("disguise-self"),
      context({ payment: { kind: "slot", slotLevel: 3 } }),
    );
    expect(announcement.text).toContain("ячейкой 3 уровня");
  });

  it("масштабирует урон заклинания по уровню ячейки", () => {
    const first = renderAnnouncement(
      spell("absorb-elements"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );
    const third = renderAnnouncement(
      spell("absorb-elements"),
      context({ payment: { kind: "slot", slotLevel: 3 } }),
    );

    expect(first.text).toContain("добавит 1d6");
    expect(third.text).toContain("добавит 3d6");
  });

  it("объявление корректно и без указанной цели (OQ-10)", () => {
    const announcement = renderAnnouncement(spell("message"), context({ mode: "cantrip" }));

    expect(announcement.text).toContain("обращаюсь к цели в пределах 120 футов");
    expect(announcement.text).not.toMatch(/ {2}/);
    expect(announcement.gaps).toEqual([
      { placeholder: "target", reasonRu: "Цель не указана" },
    ]);
  });
});

describe("renderAnnouncement: режим применения (FR-041)", () => {
  it("оплату кровью добавляет отдельной фразой: ячейка не расходуется", () => {
    const announcement = renderAnnouncement(
      spell("mage-armor"),
      context({ payment: { kind: "spell_points" }, targetLabel: "на себя" }),
    );

    expect(announcement.text).toContain(
      "Ячейка не расходуется: сотворяю за очки заклинаний (2).",
    );
  });

  it("ритуальное применение берёт шаблон как есть", () => {
    const announcement = renderAnnouncement(
      spell("identify"),
      context({ mode: "ritual", targetLabel: "кольцо из склепа" }),
    );

    expect(announcement.text).toContain("ритуалом на предмете кольцо из склепа");
    expect(announcement.gaps).toEqual([]);
  });

  it("предупреждает, что шаблон ритуала не описывает обычное сотворение", () => {
    const announcement = renderAnnouncement(
      spell("detect-magic"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(announcement.gaps).toEqual([
      {
        reasonRu:
          "Шаблон написан для ритуального применения: при обычном сотворении назовите" +
          " израсходованную ячейку и время накладывания без 10 минут ритуала",
      },
    ]);
  });
});

describe("renderAnnouncement: готовый КД (FR-093)", () => {
  it("называет КД со «Щитом» числом, а не формулой: 19 без «Доспехов мага»", () => {
    const announcement = renderAnnouncement(
      spell("shield"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(announcement.text).toContain("Мой КД становится 19");
    expect(announcement.gaps).toEqual([]);
  });

  it("учитывает активные «Доспехи мага»: КД со «Щитом» становится 22", () => {
    const withMageArmor = renderAnnouncement(
      spell("shield"),
      context({
        character: {
          ...createThorne(),
          activeEffects: [
            {
              id: "effect-mage-armor",
              spellId: "mage-armor",
              nameRu: "Доспехи мага",
              startedAt: "2026-07-31T12:00:00.000Z",
              duration: { type: "hours", value: 8 },
              isConcentration: false,
              slotLevelUsed: 1,
              contributions: [
                { stat: "armorClass", kind: "method", method: { family: "spell", base: 13 } },
              ],
              endConditionRu: "До истечения длительности.",
            },
          ],
        },
        payment: { kind: "slot", slotLevel: 1 },
      }),
    );

    expect(withMageArmor.text).toContain("Мой КД становится 22");
  });

  it("«Доспехи мага» называют итоговый КД 17", () => {
    const announcement = renderAnnouncement(
      spell("mage-armor"),
      context({ payment: { kind: "slot", slotLevel: 1 }, targetLabel: "на себя" }),
    );

    expect(announcement.text).toContain("итоговый КД цели — 17");
    expect(announcement.gaps).toEqual([]);
  });
});

describe("renderAnnouncement: чего приложение не считает", () => {
  it("помечает дальность, которой нет в данных заклинания", () => {
    const selfRange: Spell = {
      ...spell("mage-armor"),
      range: { type: "self" },
      announcementTemplate: "Дальность {range} футов.",
    };
    const announcement = renderAnnouncement(
      selfRange,
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(announcement.text).toBe("Дальность ? футов.");
    expect(announcement.gaps).toEqual([
      { placeholder: "range", reasonRu: "У заклинания нет дальности в футах" },
    ]);
  });

  it("помечает урон, которого нет в данных заклинания", () => {
    const noDamage: Spell = {
      ...spell("mage-armor"),
      announcementTemplate: "Урон {damage}.",
    };
    const announcement = renderAnnouncement(
      noDamage,
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(announcement.text).toBe("Урон ?.");
    expect(announcement.gaps).toEqual([
      { placeholder: "damage", reasonRu: "У заклинания нет формулы урона" },
    ]);
  });
});

describe("renderAnnouncement: чистота формулировки (FR-042)", () => {
  it("ни в одном объявлении нет художественного текста", () => {
    for (const card of allSpells) {
      const announcement = renderAnnouncement(
        card,
        context({
          mode: card.level === 0 ? "cantrip" : card.ritual ? "ritual" : "normal",
          payment:
            card.level === 0 || card.ritual ? { kind: "none" } : { kind: "slot", slotLevel: card.level },
          targetLabel: "гоблин у двери",
        }),
      );

      const roleplay = [
        card.roleplay.incantation,
        card.roleplay.gesture,
        card.roleplay.visualEffect,
        ...card.roleplay.completeVariants.short,
        ...card.roleplay.completeVariants.atmospheric,
        ...card.roleplay.completeVariants.sarcastic,
      ];
      for (const text of roleplay) {
        expect(announcement.text).not.toContain(text);
      }
    }
  });

  it("не оставляет незаполненных подстановок ни в одной карточке контента", () => {
    for (const card of allSpells) {
      const announcement = renderAnnouncement(
        card,
        context({
          mode: card.level === 0 ? "cantrip" : card.ritual ? "ritual" : "normal",
          payment:
            card.level === 0 || card.ritual ? { kind: "none" } : { kind: "slot", slotLevel: card.level },
          targetLabel: "гоблин у двери",
        }),
      );
      expect(announcement.text).not.toMatch(/\{[^}]*\}/);
    }
  });
});

describe("castInstructions: что сделать этому персонажу (FR-032)", () => {
  it("называет бросок атаки готовым числом, а не модификатором", () => {
    const steps = castInstructions(
      spell("ray-of-frost"),
      context({ mode: "cantrip", targetLabel: "гоблин" }),
    );

    expect(steps).toContain("Бросьте d20+8 — попадание, если результат не ниже КД цели");
    expect(steps).toContain(
      "Урон: 2d8 (холод) — только кубики, модификатор характеристики к урону не прибавляется",
    );
  });

  it("для спасброска называет характеристику и порог, а не сокращение (ADR-0012)", () => {
    // В первой партии контента заклинаний со спасброском нет: они появятся на уровнях 2–4.
    const withSave: Spell = {
      ...spell("disguise-self"),
      resolution: { type: "saving_throw", savingThrow: "DEX" },
    };
    const steps = castInstructions(
      withSave,
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );
    expect(steps).toContain("Цель бросает спасбросок Ловкости: 16 и выше — спаслась, ниже — нет");
  });

  it("на испорченных данных без характеристики называет хотя бы порог", () => {
    const broken: Spell = {
      ...spell("disguise-self"),
      resolution: { type: "saving_throw" },
    };
    expect(
      castInstructions(broken, context({ payment: { kind: "slot", slotLevel: 1 } })),
    ).toContain("Цель бросает спасбросок: 16 и выше — спаслась, ниже — нет");
  });

  it("перечисляет компоненты действиями, а не буквами", () => {
    const steps = castInstructions(
      spell("mage-armor"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(steps[0]).toBe("Произнести вслух");
    expect(steps[1]).toBe("Жест свободной рукой");
    expect(steps[2]).toBe("Компонент: кусок обработанной кожи");
  });

  it("называет, что спишется: ячейка, кровь или ничего", () => {
    const bySlot = castInstructions(
      spell("mage-armor"),
      context({ payment: { kind: "slot", slotLevel: 3 } }),
    );
    const byBlood = castInstructions(
      spell("mage-armor"),
      context({ payment: { kind: "spell_points" } }),
    );
    const byRitual = castInstructions(spell("identify"), context({ mode: "ritual" }));

    expect(bySlot).toContain("Спишется ячейка 3 уровня");
    expect(byBlood).toContain(
      "Спишется 2 очка заклинаний — заплатите 6 хитов, максимум хитов упадёт на столько же",
    );
    expect(byRitual).toContain("Ячейка не расходуется, но накладывание займёт на 10 минут дольше");
  });

  it("напоминает о проверке концентрации порогом, а не формулой (ADR-0012)", () => {
    const steps = castInstructions(
      spell("detect-magic"),
      context({ mode: "ritual" }),
    );
    expect(steps).toContain(
      "Держите концентрацию: получите урон — бросьте d20+4." +
        " Нужно 10 и больше (при уроне от 22 — половину урона и больше), иначе заклинание спадает",
    );
  });

  it("заклинание без броска говорит об этом прямо", () => {
    const steps = castInstructions(spell("mending"), context({ mode: "cantrip" }));
    expect(steps).toContain("Без броска: эффект применяется сразу");
  });

  it("эффекты успеха и провала показываются, когда они заданы", () => {
    const withEffects: Spell = {
      ...spell("disguise-self"),
      resolution: {
        type: "saving_throw",
        savingThrow: "DEX",
        successEffect: "половина урона",
        failureEffect: "полный урон и падение",
      },
    };
    const steps = castInstructions(
      withEffects,
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(steps).toContain("Если цель спаслась: половина урона");
    expect(steps).toContain("Если цель провалила спасбросок: полный урон и падение");
  });

  it("отрицательный модификатор атаки сохраняет знак", () => {
    const cursed: CharacterState = {
      ...thorne,
      activeEffects: [
        {
          ...CURSE,
          contributions: [{ stat: "spellAttackModifier", kind: "bonus", value: -10 }],
        },
      ],
    };
    const steps = castInstructions(
      spell("ray-of-frost"),
      context({ character: cursed, mode: "cantrip" }),
    );
    expect(steps).toContain("Бросьте d20−2 — попадание, если результат не ниже КД цели");
  });
})

describe("объявление обмена (FR-177)", () => {
  it("называет и хиты, и очки", () => {
    expect(bloodExchangeAnnouncement(5, thorne)).toBe(
      "Действием обмениваю 15 хитов на 5 очков заклинаний.",
    );
  });

  it("склоняет единственное число", () => {
    expect(bloodExchangeAnnouncement(1, thorne)).toBe(
      "Действием обмениваю 3 хита на 1 очко заклинаний.",
    );
  });
});

describe("инструкция обмена (FR-172, FR-174, FR-175)", () => {
  it("называет остаток хитов и снижение максимума", () => {
    const steps = bloodExchangeInstructions(5, thorne);
    expect(steps[0]).toBe("Отметьте 15 хитов: было 60, станет 45");
    expect(steps[1]).toBe(
      "Максимум тоже 45 — лечение выше не поднимет, вернуть можно только по 3 за полный час",
    );
  });

  it("напоминает о ненужной проверке концентрации только при активной концентрации", () => {
    expect(bloodExchangeInstructions(2, thorne).join(" ")).not.toMatch(/концентрац/);

    const busy = {
      ...thorne,
      concentration: { spellId: "web", startedAt: "2026-07-31T20:00:00.000Z" },
    };
    expect(bloodExchangeInstructions(2, busy).join(" ")).toMatch(
      /Проверка концентрации не нужна: потеря хитов от кровавого колдовства уроном не считается/,
    );
  });

  it("предупреждает о ранах, когда обмен опускает хиты в ноль", () => {
    const dying = { ...thorne, hitPoints: { current: 6, maximumBase: 60, bloodReduction: 0, masterReduction: 0 } };
    expect(bloodExchangeInstructions(2, dying).join(" ")).toMatch(
      /Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три очка — итого 1 рана/,
    );
  });

  it("считает раны от числа созданных очков", () => {
    const dying = { ...thorne, hitPoints: { current: 18, maximumBase: 60, bloodReduction: 0, masterReduction: 0 } };
    expect(bloodExchangeInstructions(6, dying).join(" ")).toMatch(/итого 3 раны/);
  });
});

describe("руна в объявлении (FR-151, FR-152)", () => {
  it("называет руну и её эффект отдельной фразой", () => {
    const announcement = renderAnnouncement(
      spell("web"),
      context({ payment: { kind: "slot", slotLevel: 3 }, rune: "war" }),
    );
    expect(announcement.text).toContain(
      "Применяю руну войны: +2 к броскам атаки по одному существу в пределах 30 футов" +
        " до конца вашего следующего хода.",
    );
  });

  it("пересчитывает эффект по уровню ячейки", () => {
    const announcement = renderAnnouncement(
      spell("web"),
      context({ payment: { kind: "slot", slotLevel: 4 }, rune: "life" }),
    );
    expect(announcement.text).toContain("Применяю руну жизни: 20 временных хитов");
  });

  it("при оплате кровью руну не называет (OQ-17)", () => {
    const announcement = renderAnnouncement(
      spell("web"),
      context({ payment: { kind: "spell_points" }, rune: "war" }),
    );
    expect(announcement.text).not.toMatch(/руну/);
  });

  it("инструкция говорит, что руна спишется", () => {
    const steps = castInstructions(
      spell("web"),
      context({ payment: { kind: "slot", slotLevel: 2 }, rune: "wind" }),
    );
    expect(steps).toContain(
      "Спишется руна ветра: +10 футов скорости себе и никаких атак по возможности" +
        " до начала вашего следующего хода",
    );
  });
});
