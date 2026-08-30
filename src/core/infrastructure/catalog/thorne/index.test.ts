import { describe, expect, it } from "vitest";

import {
  BANNED_SPELLS,
  ContentError,
  HARMFUL_DAMAGE_TYPES,
  loadThorneSpells,
  parseSpells,
} from "./index";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";

const spells = loadThorneSpells();

const MINIMUM_ADVICE_VARIANTS = 2;
const MAXIMUM_ADVICE_VARIANTS = 4;

const MINIMUM_VARIANT_LENGTH = 100;

function paragraphs(text: string): string[] {
  return text
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

describe("книга заклинаний Торна", () => {
  it("состоит из 33 карточек: 4 заговора и 29 заклинаний по уровням", () => {
    expect(spells).toHaveLength(33);
    const byLevel = (level: number) => spells.filter((spell) => spell.level === level).length;
    expect(byLevel(CANTRIP_LEVEL)).toBe(4);
    expect(byLevel(1)).toBe(8);
    expect(byLevel(2)).toBe(8);
    expect(byLevel(3)).toBe(9);
    expect(byLevel(4)).toBe(4);
  });

  it("у каждой карточки указан источник (ADR-0020)", () => {
    for (const spell of spells) {
      expect(spell.source, `${spell.nameRu} без источника`).toBeTruthy();
    }
  });

  it("все карточки проходят схему и имеют уникальные идентификаторы", () => {
    expect(new Set(spells.map((spell) => spell.id)).size).toBe(spells.length);
  });

  it("у каждой карточки указана роль в бою (FR-213)", () => {
    for (const spell of spells) {
      expect(spell.combatRole, `${spell.nameRu} без роли в бою`).toBeDefined();
    }
  });

  it("роли расставлены по смыслу, а не по наличию урона (FR-213)", () => {
    const byId = new Map(spells.map((spell) => [spell.id, spell.combatRole]));
    expect(byId.get("absorb-elements")).toBe("defense");
    expect(byId.get("shield")).toBe("defense");
    expect(byId.get("mage-armor")).toBe("defense");
    expect(byId.get("ray-of-frost")).toBe("offense");
    expect(byId.get("shocking-grasp")).toBe("offense");
    expect(byId.get("web")).toBe("offense");
    expect(byId.get("slow")).toBe("offense");
    expect(byId.get("counterspell")).toBe("defense");
    expect(spells.filter((spell) => spell.combatRole === "other")).toHaveLength(8);
  });
});

describe("имена навыков в тексте карточек", () => {
  it("карточки называют навык именем листа, а не прежним", () => {
    const retired = [/расследован/i, /восприят/i, /\(Магия\)/];
    for (const spell of spells) {
      const text = JSON.stringify(spell);
      for (const name of retired) {
        expect(name.test(text), `${spell.nameRu}: ${name.source}`).toBe(false);
      }
    }

    const named = (skill: string) =>
      spells.filter((spell) => JSON.stringify(spell).includes(skill)).length;
    expect(named("(Внимательность)")).toBeGreaterThan(0);
  });
});

describe("реестр запретов (FR-160, FR-161)", () => {
  it("запрещённого нет в книге ни под русским, ни под английским названием", () => {
    for (const ban of BANNED_SPELLS) {
      expect(spells.some((spell) => spell.nameEn === ban.nameEn), ban.nameRu).toBe(false);
      expect(spells.some((spell) => spell.nameRu === ban.nameRu), ban.nameRu).toBe(false);
    }
  });

  it("огонь запрещён данными, а не перечислением", () => {
    expect(HARMFUL_DAMAGE_TYPES).toContain("огонь");
    for (const spell of spells) {
      for (const harmful of HARMFUL_DAMAGE_TYPES) {
        expect(spell.damage?.type.includes(harmful) ?? false, spell.nameRu).toBe(false);
      }
    }
  });

  it("у каждого запрета есть причина словами", () => {
    for (const ban of BANNED_SPELLS) {
      expect(ban.explanationRu.length, ban.nameRu).toBeGreaterThan(20);
    }
  });
});

describe("полнота текстовых полей (FR-013)", () => {
  it("у каждой карточки есть тактический совет", () => {
    for (const spell of spells) {
      expect(spell.tacticalAdviceRu, `${spell.nameRu} без тактического совета`).toBeDefined();
    }
  });

  it("совет состоит из 2–4 названных вариантов, и ни один не оборван", () => {
    for (const spell of spells) {
      const variants = paragraphs(spell.tacticalAdviceRu ?? "");
      expect(variants.length, `${spell.nameRu}: вариантов ${variants.length}`).toBeGreaterThanOrEqual(
        MINIMUM_ADVICE_VARIANTS,
      );
      expect(variants.length, `${spell.nameRu}: вариантов ${variants.length}`).toBeLessThanOrEqual(
        MAXIMUM_ADVICE_VARIANTS,
      );
      for (const variant of variants) {
        expect(variant.length, `${spell.nameRu}: «${variant}»`).toBeGreaterThanOrEqual(
          MINIMUM_VARIANT_LENGTH,
        );
      }
    }
  });

  it("совет замкнут на своём заклинании", () => {
    const allowedNames = (spell: (typeof spells)[number]): string[] =>
      [spell.nameRu, ...(spell.fullRulesRu.match(/«[^»]+»/g) ?? []).map((quoted) => quoted.slice(1, -1))];
    for (const spell of spells) {
      const advice = spell.tacticalAdviceRu ?? "";
      const allowed = allowedNames(spell);
      for (const other of spells) {
        if (other === spell || allowed.includes(other.nameRu)) continue;
        const named = new RegExp(`(^|[^\\p{L}])${other.nameRu}([^\\p{L}]|$)`, "u");
        expect(named.test(advice), `${spell.nameRu}: совет называет «${other.nameRu}»`).toBe(false);
      }
      for (const quoted of advice.match(/«[^»]+»/g) ?? []) {
        expect(allowed, `${spell.nameRu}: в совете чужое имя ${quoted}`).toContain(quoted.slice(1, -1));
      }
    }
  });

  it("у каждой карточки есть строка списка", () => {
    for (const spell of spells) {
      expect(spell.listCard, `${spell.nameRu}: нет строки списка`).toBeDefined();
    }
  });

  it("в каждом совете названо число", () => {
    for (const spell of spells) {
      expect(/\d/.test(spell.tacticalAdviceRu ?? ""), `${spell.nameRu}: совет без чисел`).toBe(true);
    }
  });

  it("полные правила есть у каждой карточки и длиннее кратких", () => {
    for (const spell of spells) {
      expect(spell.fullRulesRu, `${spell.nameRu} без полных правил`).toBeTruthy();
      expect(
        spell.fullRulesRu.length,
        `${spell.nameRu}: полные правила короче кратких`,
      ).toBeGreaterThan(spell.shortRulesRu.length);
    }
  });

  it("масштабирование урона в данных объяснено в тексте о повышении уровня", () => {
    for (const spell of spells.filter((candidate) => candidate.damage?.scaling !== undefined)) {
      expect(spell.higherLevelsRu, `${spell.nameRu}: есть масштабирование, нет текста`).toBeTruthy();
    }
  });
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
    ["расходуемый компонент", "arcane-lock", (s: NonNullable<ReturnType<typeof byId.get>>) => s.components.consumed === true],
    ["компонент со стоимостью", "arcane-lock", (s: NonNullable<ReturnType<typeof byId.get>>) => s.components.costGp === 25],
    ["область-сфера", "detect-magic", (s: NonNullable<ReturnType<typeof byId.get>>) => s.area?.shape === "sphere"],
  ])("механика «%s» покрыта карточкой %s", (_mechanic, id, predicate) => {
    const spell = byId.get(id);
    expect(spell, `карточка ${id} отсутствует`).toBeDefined();
    expect(predicate(spell!)).toBe(true);
  });

  it("каждая реакция описывает свой триггер", () => {
    const reactions = spells.filter((spell) => spell.castingTime.type === "reaction");
    expect(reactions.map((spell) => spell.id).sort()).toEqual([
      "absorb-elements",
      "counterspell",
      "feather-fall",
      "shield",
    ]);
    for (const reaction of reactions) {
      expect(reaction.castingTime.reactionTrigger, reaction.nameRu).toBeTruthy();
    }
  });

  it("ритуалы не расходуют ячейку и потому не входят в подготовку", () => {
    const rituals = spells.filter((spell) => spell.ritual);
    expect(rituals.map((spell) => spell.id).sort()).toEqual(["alarm", "detect-magic"]);
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

  it("причина отказа карточки названа по-русски, а не словами библиотеки", () => {
    expect(() => parseSpells(["это не карточка"])).toThrow(/ожидалось объект, получено строка/);
  });

  it("сообщает об ошибке и когда поле указать нельзя", () => {
    expect(() => parseSpells(["это не карточка"])).toThrow(/Карточка №1 не прошла проверку — —/);
  });
});

describe("схемы ритуалов (FR-190)", () => {
  it("схема есть у каждого ритуала и только у ритуала", () => {
    for (const spell of spells) {
      expect(spell.ritualDiagram !== undefined, spell.nameRu).toBe(spell.ritual);
    }
  });

  it("у каждой схемы есть подпись и печать", () => {
    for (const spell of spells.filter((candidate) => candidate.ritual)) {
      expect(spell.ritualDiagram?.captionRu, spell.nameRu).toBeTruthy();
      expect(spell.ritualDiagram?.centralSeal.kind, spell.nameRu).toBeTruthy();
    }
  });

  it("надпись сопровождается переводом: иначе её содержание не вычитать", () => {
    for (const spell of spells.filter((candidate) => candidate.ritualDiagram?.inscription)) {
      expect(spell.ritualDiagram?.inscription?.meaningRu, spell.nameRu).toBeTruthy();
    }
  });

  it("схемы не повторяют друг друга: у каждой свой набор слоёв", () => {
    const shapes = spells
      .filter((spell) => spell.ritual)
      .map((spell) => JSON.stringify(spell.ritualDiagram));
    expect(new Set(shapes).size).toBe(2);
  });
});

describe("расход костей хитов (FR-135)", () => {
  it("поле есть ровно у «Мистической бодрости»", () => {
    const withCost = spells.filter((spell) => spell.hitDiceCost !== undefined);
    expect(withCost.map((spell) => spell.nameRu)).toEqual(["Мистическая бодрость"]);
  });

  it("числа совпадают с тем, что карточка обещает игроку", () => {
    const [vigor] = spells.filter((spell) => spell.hitDiceCost !== undefined);
    expect(vigor?.hitDiceCost).toEqual({
      maximumDice: 2,
      extraDicePerSlotLevel: 2,
      addsSpellcastingModifier: true,
    });
    expect(vigor?.higherLevelsRu).toContain("до шести ячейкой 4");
  });
});
