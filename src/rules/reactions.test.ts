import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";

import {
  availableTriggers,
  reactionsFor,
  REACTION_TRIGGERS,
  REACTION_TRIGGER_LABEL,
} from "./reactions";

const SPELLS = loadThorneSpells();

describe("reactionsFor (FR-061)", () => {
  it.each([
    ["attacked", ["shield"]],
    ["elemental_damage", ["absorb-elements"]],
    ["falling", ["feather-fall"]],
    ["enemy_casts", ["counterspell"]],
  ] as const)("на событие «%s» отвечает %s", (trigger, expected) => {
    expect(reactionsFor(SPELLS, trigger).map((spell) => spell.id)).toEqual([...expected]);
  });

  it("на успешный бросок врага ответить нечем: «Искусная острота» в книгу не вошла", () => {
    // OQ-04 остаётся открытым именно поэтому — триггер поддержан, а покрытия у него нет.
    expect(reactionsFor(SPELLS, "enemy_succeeds")).toEqual([]);
  });

  it("не считает реакцией то, что творится действием", () => {
    for (const trigger of REACTION_TRIGGERS) {
      for (const spell of reactionsFor(SPELLS, trigger)) {
        expect(spell.castingTime.type, spell.nameRu).toBe("reaction");
      }
    }
  });
});

describe("availableTriggers (FR-002, FR-061)", () => {
  it("предлагает только те события, на которые есть ответ", () => {
    expect(availableTriggers(SPELLS)).toEqual([
      "attacked",
      "elemental_damage",
      "enemy_casts",
      "falling",
      "failed_save",
    ]);
  });

  it("«я провалил спасбросок» остаётся всегда: на него отвечает руна, а не заклинание", () => {
    // «Знаки ограждения» — особенность подкласса (FR-153), и в книге заклинаний её нет по
    // определению. Без исключения вопрос исчез бы вместе с единственным ответом.
    expect(availableTriggers([])).toEqual(["failed_save"]);
  });

  it("у каждого события есть подпись словами игрока", () => {
    for (const trigger of REACTION_TRIGGERS) {
      expect(REACTION_TRIGGER_LABEL[trigger], trigger).toBeTruthy();
    }
  });
});
