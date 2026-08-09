/**
 * Проекция списка заклинаний.
 *
 * Проверяется то, чего в карточке нет: цена момента, применимость в обстановке, причина отказа и
 * урон, посчитанный под этого персонажа. Сами поля карточки не пересказываются — за них отвечает
 * контент и его собственный прогон.
 */

import { describe, expect, it } from "vitest";

import type { Command } from "@/contract/commands";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withSpellPoints, withoutSlots } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";

import { toCastingView, toSpellRowViews, toTurnView } from "./spellRowsView";

const CLOCK = { now: () => "2026-07-31T18:00:00.000Z", nextId: () => "id-1" };

/** Обстановка набирается командами: признак боя выводит схватка, а не подстановка. */
function played(
  character: CharacterState,
  commands: readonly Command[] = [],
  catalog: readonly Spell[] = loadThorneSpells(),
): LiveSession {
  const builtInCatalog = catalog;
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
  return live;
}

const START: readonly Command[] = [{ kind: "start_combat" }];

function row(
  id: string,
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
  catalog?: readonly Spell[],
) {
  const found = toSpellRowViews(played(character, commands, catalog)).find(
    (spell) => spell.id === id,
  );
  if (found === undefined) throw new Error(`нет строки ${id}`);
  return found;
}

describe("цена и обстановка", () => {
  it("вне боя ритуал стоит ноль, с началом боя — свой уровень", () => {
    expect(row("detect-magic").slotPrice).toBe(0);
    expect(row("detect-magic", createThorne(), START).slotPrice).toBe(1);
  });

  it("ритуальный способ исчезает с началом боя", () => {
    expect(row("detect-magic").ritualAvailable).toBe(true);
    expect(row("detect-magic", createThorne(), START).ritualAvailable).toBe(false);
  });

  it("неподготовленный ритуал в бою становится несотворимым вовсе", () => {
    expect(row("detect-magic").castableNow).toBe(true);
    expect(row("detect-magic", createThorne(), START).castableNow).toBe(false);
  });

  it("подготовка меняет применимость, а не цену", () => {
    const thorne = createThorne();
    const ready = { ...thorne, preparedSpellIds: [...thorne.preparedSpellIds, "detect-magic"] };

    expect(row("detect-magic", ready, START).castableNow).toBe(true);
    expect(row("detect-magic", ready, START).prepared).toBe(true);
  });
});

describe("почему нельзя", () => {
  it("доступное причины не несёт вовсе", () => {
    expect(row("ray-of-frost").unavailableReason).toBeUndefined();
  });

  it("без свободных ячеек причина названа словами владельца", () => {
    const reason = row("mage-armor", withoutSlots(createThorne())).unavailableReason;

    expect(reason).toBeDefined();
    expect(reason).not.toBe("");
  });

  it("оплата кровью снимает причину: способ найден другой", () => {
    const paid = withSpellPoints(withoutSlots(createThorne()), 2);

    expect(row("mage-armor", paid).unavailableReason).toBeUndefined();
  });

  it("заклинание, до уровня которого он не дорос, объясняется отсутствием способа", () => {
    // Карточка выше и ячеек, и таблицы кровавого колдовства: способов у него нет вовсе. Такой в
    // книге Торна нет, поэтому она берётся из настоящей и поднимается уровнем.
    const catalog = loadThorneSpells();
    const highest = catalog.find((spell) => spell.id === "polymorph");
    if (highest === undefined) throw new Error("нет карточки для подъёма уровня");
    const beyond = [{ ...highest, level: 6, ritual: false }];

    expect(row(highest.id, createThorne(), [], beyond).unavailableReason).toBe(
      "нет доступного способа сотворения",
    );
  });
});

describe("числа под этого персонажа", () => {
  it("урон заговора считается по уровню персонажа, а не по книге", () => {
    // Торн седьмого уровня: «Луч холода» бросает две кости вместо одной.
    expect(row("ray-of-frost").damage).toEqual({ formula: "2d8", type: "холод" });
  });

  it("заклинание без урона поля урона не несёт", () => {
    expect(row("mage-armor").damage).toBeUndefined();
  });

  it("висящий эффект помечает свою строку", () => {
    const cast: readonly Command[] = [
      { kind: "cast_spell", spellId: "mage-armor", mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
    ];

    expect(row("mage-armor").active).toBe(false);
    expect(row("mage-armor", createThorne(), cast).active).toBe(true);
  });

  it("защита с этим заклинанием считается заранее, а без вклада её нет вовсе", () => {
    // «Доспехи мага» назначают КД 13 + Ловкость; у Торна с надетым он не падает ниже своего.
    expect(row("mage-armor").armorClassIfCast).toBeGreaterThan(0);
    expect(row("ray-of-frost").armorClassIfCast).toBeUndefined();
  });

  it("числа заклинателя стоят раз на персонажа, а не при каждой строке", () => {
    expect(toCastingView(createThorne())).toEqual({
      spellAttackModifier: 8,
      spellSaveDc: 16,
      spellcastingModifier: 4,
      preparedLimit: 11,
      preparedCount: createThorne().preparedSpellIds.length,
    });
  });
});

describe("что сделать и как объявить", () => {
  it("собираются тем же способом, что предложит мастер применения", () => {
    // Вне боя «Обнаружение магии» творится ритуалом — и объявление, и шаги говорят про него.
    expect(row("detect-magic").instructions.join(" ")).toContain("10 минут");
    expect(row("detect-magic", createThorne(), START).instructions.join(" ")).toContain("ячейка");
  });

  it("объявление называет числа этого персонажа", () => {
    expect(row("ray-of-frost").announcement.text).toContain("8");
  });

  it("незаполненное в объявлении названо, а не замолчано", () => {
    const gaps = row("ray-of-frost").announcement.gaps;

    expect(gaps.some((gap) => gap.placeholder === "target")).toBe(true);
    expect(gaps.every((gap) => gap.reasonRu !== "")).toBe(true);
  });
});

describe("экономия хода", () => {
  it("вне боя ходов нет: раунда не считают, всё доступно", () => {
    expect(toTurnView(played(createThorne()))).toMatchObject({ inFight: false, round: 1 });
  });

  it("сотворённое заклинание тратит своё действие", () => {
    const spent = played(createThorne(), [
      ...START,
      { kind: "cast_spell", spellId: "ray-of-frost", mode: "cantrip", payment: { kind: "none" } },
    ]);

    expect(toTurnView(spent)).toMatchObject({ inFight: true, actionAvailable: false });
  });
});
