import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import type { Spell } from "@/data/schemas/spell";
import { castInstructions, renderAnnouncement, type AnnouncementContext } from "./announcement";

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
    // КС 16, а не 15: предмет добавляет +1 (OQ-11).
    expect(announcement.text).toContain("против КС 16");
  });

  it("сохраняет знак отрицательного модификатора атаки", () => {
    const cursed = { ...thorne, spellAttackModifier: -1 };
    const announcement = renderAnnouncement(
      spell("ray-of-frost"),
      context({ character: cursed, mode: "cantrip", targetLabel: "гоблин" }),
    );
    expect(announcement.text).toContain("модификатор -1");
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
              type: "buff",
              startedAt: "2026-07-31T12:00:00.000Z",
              duration: { type: "hours", value: 8 },
              isConcentration: false,
              slotLevelUsed: 1,
              armorClass: { kind: "base_override", value: 13 },
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

    expect(steps).toContain("Бросьте d20 +8 — попадание, если результат не ниже КД цели");
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
      "Держите концентрацию: получите урон — бросьте d20 +4." +
        " Нужно 10 и больше (при уроне от 22 — половину урона и больше), иначе заклинание спадает",
    );
  });

  it("заклинание без броска говорит об этом прямо", () => {
    const steps = castInstructions(spell("mending"), context({ mode: "cantrip" }));
    expect(steps).toContain("Броска нет: эффект применяется сразу");
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
    const cursed = { ...thorne, spellAttackModifier: -2 };
    const steps = castInstructions(
      spell("ray-of-frost"),
      context({ character: cursed, mode: "cantrip" }),
    );
    expect(steps).toContain("Бросьте d20 -2 — попадание, если результат не ниже КД цели");
  });
})
