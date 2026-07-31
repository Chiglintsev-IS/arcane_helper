import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import type { Spell } from "@/data/schemas/spell";
import { renderAnnouncement, type AnnouncementContext } from "./announcement";

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

describe("renderAnnouncement: чего приложение не считает", () => {
  it("не выдумывает готовый КД: подстановка помечена пробелом с причиной (FR-062, OQ-02)", () => {
    const announcement = renderAnnouncement(
      spell("shield"),
      context({ payment: { kind: "slot", slotLevel: 1 } }),
    );

    expect(announcement.text).toContain("Мой КД становится ?");
    expect(announcement.gaps).toEqual([
      {
        placeholder: "armorClass",
        reasonRu: "Готовый КД с учётом заклинания приложение пока не считает (FR-062, OQ-02)",
      },
    ]);
  });

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
        ...card.roleplay.incantations,
        ...card.roleplay.gestures,
        ...card.roleplay.visualEffects,
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
