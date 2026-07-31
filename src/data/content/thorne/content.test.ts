import { describe, expect, it } from "vitest";

import { BANNED_SPELLS, ContentError, HARMFUL_DAMAGE_TYPES, loadThorneSpells, parseSpells } from ".";
import { CANTRIP_LEVEL, MINIMUM_COMPLETE_VARIANTS } from "@/data/schemas/spell";

const spells = loadThorneSpells();

/** Профиль отыгрыша Торна — docs/domain-model.md#профиль-отыгрыша. */
const PROHIBITED_THEMES = ["огон", "пламен", "пожар", "костёр"];
const MAXIMUM_PHRASE_WORDS = 15;

function roleplayTexts(spell: (typeof spells)[number]): string[] {
  return [
    ...spell.roleplay.incantations,
    ...spell.roleplay.gestures,
    ...spell.roleplay.visualEffects,
    ...spell.roleplay.completeVariants.short,
    ...spell.roleplay.completeVariants.atmospheric,
    ...spell.roleplay.completeVariants.sarcastic,
  ];
}

describe("первая партия контента", () => {
  it("состоит из 12 карточек: 4 заговора и 8 заклинаний 1 уровня", () => {
    expect(spells).toHaveLength(12);
    expect(spells.filter((spell) => spell.level === CANTRIP_LEVEL)).toHaveLength(4);
    expect(spells.filter((spell) => spell.level === 1)).toHaveLength(8);
  });

  it("все карточки проходят схему и имеют уникальные идентификаторы", () => {
    expect(new Set(spells.map((spell) => spell.id)).size).toBe(spells.length);
  });

  it("не содержит запрещённых мастером заклинаний", () => {
    const bannedNames = new Set(BANNED_SPELLS.map((banned) => banned.nameEn));
    for (const spell of spells) {
      expect(bannedNames.has(spell.nameEn), `${spell.nameRu} запрещено мастером`).toBe(false);
    }
  });

  it("не содержит урона типов, вредных виду персонажа", () => {
    for (const spell of spells) {
      if (spell.damage === undefined) continue;
      for (const harmful of HARMFUL_DAMAGE_TYPES) {
        expect(spell.damage.type.includes(harmful), `${spell.nameRu} наносит ${harmful}`).toBe(false);
      }
    }
  });
});

describe("соответствие профилю отыгрыша (FR-052)", () => {
  it.each(spells.map((spell) => [spell.nameRu, spell] as const))(
    "«%s» не упоминает запрещённые темы",
    (_name, spell) => {
      for (const text of roleplayTexts(spell)) {
        const lowered = text.toLowerCase();
        for (const theme of PROHIBITED_THEMES) {
          // Исключение: «Поглощение стихий» обязано называть огонь — это его триггер и главный
          // смысл для уязвимого к огню персонажа. Запрет касается тематики магии Торна,
          // а не упоминания опасности.
          if (spell.id === "absorb-elements") continue;
          expect(lowered.includes(theme), `${spell.nameRu}: «${text}»`).toBe(false);
        }
      }
    },
  );

  it.each(spells.map((spell) => [spell.nameRu, spell] as const))(
    "реплики «%s» не длиннее 15 слов",
    (_name, spell) => {
      for (const incantation of spell.roleplay.incantations) {
        const words = incantation.split(/\s+/).filter(Boolean);
        expect(words.length, `${spell.nameRu}: «${incantation}»`).toBeLessThanOrEqual(
          MAXIMUM_PHRASE_WORDS,
        );
      }
    },
  );

  it.each(spells.map((spell) => [spell.nameRu, spell] as const))(
    "«%s» имеет минимум контента по FR-050",
    (_name, spell) => {
      expect(spell.roleplay.incantations.length).toBeGreaterThanOrEqual(1);
      expect(spell.roleplay.gestures.length).toBeGreaterThanOrEqual(1);
      expect(spell.roleplay.visualEffects.length).toBeGreaterThanOrEqual(1);
      const variants =
        spell.roleplay.completeVariants.short.length +
        spell.roleplay.completeVariants.atmospheric.length +
        spell.roleplay.completeVariants.sarcastic.length;
      expect(variants).toBeGreaterThanOrEqual(MINIMUM_COMPLETE_VARIANTS);
    },
  );
});

describe("покрытие механик первой партией", () => {
  const byId = new Map(spells.map((spell) => [spell.id, spell]));

  it.each([
    ["атака заклинанием", "shocking-grasp", (s: NonNullable<ReturnType<typeof byId.get>>) => s.resolution.type === "spell_attack"],
    ["масштабирование заговора", "ray-of-frost", (s: NonNullable<ReturnType<typeof byId.get>>) => s.damage?.scaling?.[5] !== undefined],
    ["реакция", "shield", (s: NonNullable<ReturnType<typeof byId.get>>) => s.castingTime.type === "reaction"],
    ["ритуал", "detect-magic", (s: NonNullable<ReturnType<typeof byId.get>>) => s.ritual],
    ["концентрация", "detect-magic", (s: NonNullable<ReturnType<typeof byId.get>>) => s.concentration],
    ["цель-предмет", "mending", (s: NonNullable<ReturnType<typeof byId.get>>) => s.targeting.type === "object"],
    ["время «минута»", "mending", (s: NonNullable<ReturnType<typeof byId.get>>) => s.castingTime.type === "minute"],
    ["время «час»", "find-familiar", (s: NonNullable<ReturnType<typeof byId.get>>) => s.castingTime.type === "hour"],
    ["расходуемый компонент", "find-familiar", (s: NonNullable<ReturnType<typeof byId.get>>) => s.components.consumed === true],
    ["компонент со стоимостью", "identify", (s: NonNullable<ReturnType<typeof byId.get>>) => s.components.costGp === 100],
    ["область-сфера", "detect-magic", (s: NonNullable<ReturnType<typeof byId.get>>) => s.area?.shape === "sphere"],
  ])("механика «%s» покрыта карточкой %s", (_mechanic, id, predicate) => {
    const spell = byId.get(id);
    expect(spell, `карточка ${id} отсутствует`).toBeDefined();
    expect(predicate(spell!)).toBe(true);
  });

  it("каждая реакция описывает свой триггер", () => {
    const reactions = spells.filter((spell) => spell.castingTime.type === "reaction");
    expect(reactions).toHaveLength(2);
    for (const reaction of reactions) {
      expect(reaction.castingTime.reactionTrigger).toBeTruthy();
    }
  });

  it("ритуалы не расходуют ячейку и потому не входят в подготовку", () => {
    const rituals = spells.filter((spell) => spell.ritual);
    expect(rituals.map((spell) => spell.id).sort()).toEqual([
      "detect-magic",
      "find-familiar",
      "identify",
      "unseen-servant",
    ]);
  });
});

describe("объявления мастеру", () => {
  it("не содержат художественного текста (FR-042)", () => {
    for (const spell of spells) {
      for (const text of roleplayTexts(spell)) {
        expect(
          spell.announcementTemplate.includes(text),
          `${spell.nameRu} тащит отыгрыш в объявление`,
        ).toBe(false);
      }
    }
  });

  it("используют только известные подстановки", () => {
    // Валидацию делает схема; тест фиксирует, что подстановки вообще применяются.
    const withPlaceholders = spells.filter((spell) => spell.announcementTemplate.includes("{"));
    expect(withPlaceholders.length).toBeGreaterThan(spells.length / 2);
  });
});

describe("загрузчик контента отказывает целиком, а не частично", () => {
  it("отклоняет битую карточку с указанием места ошибки", () => {
    const broken = { ...structuredClone(spells[0]), level: 99 };
    expect(() => parseSpells([broken])).toThrow(ContentError);
    expect(() => parseSpells([broken])).toThrow(/Карточка №1 не прошла проверку/);
  });

  it("отклоняет повтор идентификатора", () => {
    const card = structuredClone(spells[0]);
    expect(() => parseSpells([card, card])).toThrow(/встречается дважды/);
  });

  it("на пустом списке возвращает пустой результат", () => {
    expect(parseSpells([])).toEqual([]);
  });

  it("сообщает об ошибке и когда поле указать нельзя", () => {
    // Не объект вовсе: ошибка относится к карточке целиком, а не к полю внутри неё.
    expect(() => parseSpells(["это не карточка"])).toThrow(/Карточка №1 не прошла проверку — —/);
  });
});
