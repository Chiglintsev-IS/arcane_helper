/**
 * Проекция концентрации.
 *
 * Проверяется посчитанное: раунд начала, урон по потраченной ячейке, сложность спасброска и то,
 * какой проверки требует последний урон. Поля самого эффекта не пересказываются — за них отвечает
 * доска эффектов и её собственный прогон.
 */

import { describe, expect, it } from "vitest";

import type { Command } from "@/contract/commands";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { toConcentrationView } from "./concentrationView";

const CATALOG = loadThorneSpells();

function occasion(commandId: string, second: number) {
  return {
    now: () => new Date(Date.UTC(2026, 7, 9, 12, 0, second)).toISOString(),
    nextId: () => `id-${commandId}`,
    commandId,
  };
}

function played(
  commands: readonly Command[],
  options: { character?: CharacterState; catalog?: readonly Spell[] } = {},
): LiveSession {
  const character = options.character ?? createThorne();
  const builtInCatalog = options.catalog ?? CATALOG;
  return commands.reduce<LiveSession>(
    (live, command, index) =>
      applyCommand(live, command, occasion(`command-${index}`, index), {
        builtInCatalog,
        createInitialCharacter: () => character,
      }),
    { session: createSession(character), spellCatalog: builtInCatalog, spellCatalogSource: "built_in" },
  );
}

const castWeb = (slotLevel: number): Command => ({
  kind: "cast_spell",
  spellId: "web",
  mode: "normal",
  payment: { kind: "slot", slotLevel },
});

function viewOf(commands: readonly Command[], options?: Parameters<typeof played>[1]) {
  const view = toConcentrationView(played(commands, options));
  if (view === undefined) throw new Error("концентрации нет");
  return view;
}

describe("что держится", () => {
  it("без концентрации проекции нет вовсе", () => {
    expect(toConcentrationView(played([{ kind: "start_combat" }]))).toBeUndefined();
  });

  it("называет заклинание, потраченную ячейку и длительность словами правил", () => {
    const view = viewOf([castWeb(2)]);

    expect(view.spellId).toBe("web");
    expect(view.nameRu).toBe("Паутина");
    expect(view.slotLevelUsed).toBe(2);
    expect(view.durationRu).toBe("до 1 часа");
    expect(view.shortRulesRu).toContain("клейких нитей");
  });

  it("раунд начала считается по ходам боя", () => {
    const view = viewOf([
      { kind: "start_combat" },
      { kind: "begin_turn" },
      { kind: "begin_turn" },
      castWeb(2),
    ]);

    expect(view.startedOnRound).toBe(2);
    expect(view.startApproximate).toBe(false);
  });

  it("без карточки в каталоге правила деградируют до слов самого эффекта", () => {
    const view = viewOf([castWeb(2)], { catalog: CATALOG }).spellId;
    const withoutCard = toConcentrationView({
      ...played([castWeb(2)]),
      spellCatalog: CATALOG.filter((spell) => spell.id !== "web"),
    });

    expect(view).toBe("web");
    expect(withoutCard?.spellId).toBeUndefined();
    expect(withoutCard?.shortRulesRu).toContain("концентрации");
    expect(withoutCard?.damage).toBeUndefined();
  });
});

describe("урон эффекта", () => {
  /** Паутина с уроном: в книге Торна концентрационного урона нет, а правило повышения — есть. */
  const withDamage: readonly Spell[] = CATALOG.map((spell) =>
    spell.id === "web"
      ? { ...spell, damage: { dice: "2d8", type: "холод", scaling: { 3: "3d8" } } }
      : spell,
  );

  it("считается по потраченной ячейке, а не по уровню заклинания", () => {
    expect(viewOf([castWeb(2)], { catalog: withDamage }).damage).toEqual({
      formula: "2d8",
      type: "холод",
    });
    expect(viewOf([castWeb(3)], { catalog: withDamage }).damage?.formula).toBe("3d8");
  });
});

describe("проверка после урона", () => {
  it("без урона отвечать не на что", () => {
    expect(viewOf([castWeb(2)]).checkAfterDamage).toBeUndefined();
  });

  it("сложность растёт с уроном, а вердикт едет перечислением", () => {
    const view = viewOf([castWeb(2), { kind: "take_damage", damage: 24 }]);

    expect(view.checkAfterDamage).toEqual({
      dc: 12,
      modifier: view.save,
      hasAdvantage: false,
      minimumRoll: 12 - view.save,
      outcome: "threshold",
    });
  });

  it("малый урон не опускает сложность ниже наименьшей", () => {
    const view = viewOf([castWeb(2), { kind: "take_damage", damage: 3 }]);

    expect(view.checkAfterDamage?.dc).toBe(view.minimumDc);
  });

  it("непроходимая проверка названа непроходимой", () => {
    const view = viewOf([castWeb(2), { kind: "take_damage", damage: 90 }]);

    expect(view.checkAfterDamage?.outcome).toBe("impossible");
  });

  it("следующее действие закрывает вопрос: ответом служит оно само", () => {
    const answered = viewOf([
      castWeb(2),
      { kind: "take_damage", damage: 24 },
      { kind: "spend_rune_on_warding_sigil" },
    ]);

    expect(answered.checkAfterDamage).toBeUndefined();
  });

  it("при активной концентрации плата кровью проверки не предлагает", () => {
    // Потеря хитов от собственного колдовства уроном не считается: запись сотворения урона не
    // несёт, и спрашивать проверку не о чем.
    const view = viewOf([
      castWeb(2),
      { kind: "cast_spell", spellId: "shield", mode: "normal", payment: { kind: "blood", castLevel: 1 } },
    ]);

    expect(view.checkAfterDamage).toBeUndefined();
  });

  it("урон, полученный до начала концентрации, её не срывает", () => {
    const view = viewOf([{ kind: "take_damage", damage: 24 }, castWeb(2)]);

    expect(view.checkAfterDamage).toBeUndefined();
  });
});
