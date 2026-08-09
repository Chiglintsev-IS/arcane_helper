/**
 * Проекция ресурсов: то, чем платят и что мешает, посчитанным.
 *
 * Проверяется ровно то, чего до проекции не было ни у кого одного: порядок ячеек, ручная поправка
 * защиты, отделённая от самой защиты, и свёрнутые числа начала хода.
 */

import { describe, expect, it } from "vitest";

import type { Command } from "@/contract/commands";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";
import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import {
  withSpellPoints,
  withSpentSlots,
  withoutRunes,
} from "@/core/infrastructure/catalog/thorne/fixtures";

import { toResourcesView } from "./resourcesView";

const CLOCK = { now: () => "2026-07-31T18:00:00.000Z", nextId: () => "id-1" };

/** Состояние набирается командами: поправку заводит та же операция, что и шапка ресурсов. */
function played(character: CharacterState, commands: readonly Command[]): CharacterState {
  const builtInCatalog = loadThorneSpells();
  let live: LiveSession = {
    session: createSession(character),
    spellCatalog: builtInCatalog,
    spellCatalogSource: "built_in",
  };
  commands.forEach((command, index) => {
    live = applyCommand(live, command, { ...CLOCK, commandId: `command-${index}` }, {
      builtInCatalog,
      createInitialCharacter: () => character,
    });
  });
  return live.session.character;
}

describe("ячейки", () => {
  it("едут по возрастанию уровня", () => {
    const levels = toResourcesView(createThorne()).slots.map((slot) => slot.level);

    expect(levels).toEqual([...levels].sort((left, right) => left - right));
  });

  it("несут остаток и предел уровня", () => {
    const [first] = toResourcesView(withSpentSlots(createThorne(), 1, 2)).slots;

    expect(first?.remaining).toBe((first?.maximum ?? 0) - 2);
  });
});

describe("запасы", () => {
  it("руны едут остатком и пределом", () => {
    expect(toResourcesView(withoutRunes(createThorne())).runes.remaining).toBe(0);
  });

  it("очки заклинаний едут остатком", () => {
    expect(toResourcesView(withSpellPoints(createThorne(), 3)).spellPoints).toBe(3);
  });
});

describe("Класс Доспеха", () => {
  it("ручная поправка едет отдельно от самой защиты", () => {
    const adjusted = played(createThorne(), [{ kind: "set_armor_class_adjustment", value: 2 }]);

    expect(toResourcesView(adjusted).armorClassAdjustment).toBe(2);
  });

  it("без поправки — ноль, а не отсутствие числа", () => {
    expect(toResourcesView(createThorne()).armorClassAdjustment).toBe(0);
  });
});

describe("числа начала хода", () => {
  it("пассивное восприятие и инициатива приходят посчитанными", () => {
    const sheet = Character.of(createThorne()).sheet;
    const view = toResourcesView(createThorne());

    expect(view.passivePerception).toBe(sheet.value("passivePerception"));
    expect(view.initiative).toBe(sheet.value("initiative"));
  });
});

describe("подавление", () => {
  it("едет признаками: приложение показывает, а решает мастер", () => {
    const burned = played(createThorne(), [{ kind: "take_damage", damage: 4, fire: true }]);

    expect(toResourcesView(burned).suppression.firedUpon).toBe(true);
    expect(toResourcesView(createThorne()).suppression.underDirectSunlight).toBe(false);
  });
});
