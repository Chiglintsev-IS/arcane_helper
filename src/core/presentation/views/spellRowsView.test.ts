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
import {
  knowing,
  withSpentSlots,
  withoutComponentRecord,
  withoutSlots,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";

import {
  toCastingView,
  toSpellRowViews,
  toSpellsRefusal,
  toTurnView,
} from "./spellRowsView";

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

/** Ни ячеек, ни крови: под прямым солнцем кровавое колдовство не действует. */
function withoutAnyPayment(): CharacterState {
  return {
    ...withoutSlots(createThorne()),
    suppression: { firedUponTurnStarts: 0, underDirectSunlight: true },
  };
}

describe("почему нельзя", () => {
  it("доступное причины не несёт вовсе", () => {
    expect(row("ray-of-frost").unavailableReason).toBeUndefined();
  });

  it("без ячеек и без крови причина названа словами владельца", () => {
    const reason = row("mage-armor", withoutAnyPayment()).unavailableReason;

    expect(reason).toBeDefined();
    expect(reason).not.toBe("");
  });

  it("оплата кровью снимает причину: ячейку она создаёт сама", () => {
    expect(row("mage-armor", withoutSlots(createThorne())).unavailableReason).toBeUndefined();
  });

  it("заклинание, до уровня которого он не дорос, называет недостающую ячейку", () => {
    // Карточка выше и ячеек, и таблицы кровавого колдовства: способов у него нет вовсе. Такой в
    // книге Торна нет, поэтому она берётся из настоящей и поднимается уровнем. Мастер применения
    // всё равно откроется — и обязан сказать, чем это заклинание сотворяли бы.
    const catalog = loadThorneSpells();
    const highest = catalog.find((spell) => spell.id === "storm-sphere");
    if (highest === undefined) throw new Error("нет карточки для подъёма уровня");
    const beyond = [{ ...highest, level: 6, ritual: false }];
    const shown = row(highest.id, createThorne(), [], beyond);

    expect(shown.unavailableReason).toBe("Ячеек 6 уровня у персонажа нет");
    expect(shown.castOptions).toEqual([
      expect.objectContaining({
        payment: { kind: "slot", slotLevel: 6 },
        suggested: true,
        available: false,
      }),
    ]);
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
      freeComponentsCovered: true,
    });
  });

  it("о незаведённом снаряжении вердикта нет вовсе", () => {
    const stranger = withoutComponentRecord(createThorne());

    expect(toCastingView(stranger).freeComponentsCovered).toBeUndefined();
  });
});

describe("карточка", () => {
  it("едет строкой целиком: чем написана, куда целится и что говорят", () => {
    expect(row("shield").card).toMatchObject({
      nameEn: "Shield",
      school: "Ограждение",
      targeting: { type: "self" },
    });
    expect(row("shield").card.fullRulesRu).not.toBe("");
  });

  it("от персонажа не зависит ничем: у обездоленного она та же", () => {
    expect(row("shield", withoutSlots(createThorne())).card).toEqual(row("shield").card);
  });

  it("реакция приезжает фразой своего условия", () => {
    expect(row("shield").card.reaction?.textRu).toContain("попали атакой");
    // Заклинание, которое реакцией не творится, о событии молчит, а не отвечает пустой строкой.
    expect(row("ray-of-frost").card.reaction).toBeUndefined();
  });

  it("несказанного не выдумывает: без совета его нет вовсе", () => {
    // Поле необязательно, потому что та же схема читает пользовательский импорт: файл,
    // выгруженный прежней сборкой, обязан открываться.
    const found = loadThorneSpells().find((spell) => spell.id === "shield");
    if (found === undefined) throw new Error("нет карточки реакции");
    const { tacticalAdviceRu: _advice, ...bare } = found;
    const shown = row("shield", createThorne(), [], [bare]).card;

    expect(shown.tacticalAdviceRu).toBeUndefined();
    expect(shown.reaction).toEqual({ textRu: found.castingTime.reactionTrigger });
  });

  it("спасбросок называет, что даёт успех и что провал", () => {
    expect(row("web").card).toMatchObject({
      successEffectRu: expect.stringContaining("не опутано"),
      failureEffectRu: expect.stringContaining("Опутанный"),
    });
  });

  it("свой компонент назван словами, и строка знает, лежит ли он в сумке", () => {
    // Компонент «Волшебного замка» — золотая пыль за 25 зм: фокусировка их не заменяет. Само
    // заклинание отложено столом, поэтому книга дописывается прогоном: проверяется строка, а не
    // сегодняшний состав книги.
    const knows = knowing(createThorne(), "arcane-lock");
    expect(row("arcane-lock", knows).card.components.material?.textRu).toContain("золотая пыль");
    expect(row("arcane-lock", knows).ownComponentCarried).toBe(false);

    const bought = row("arcane-lock", knows, [
      { kind: "toggle_material", spellId: "arcane-lock" },
    ]);
    expect(bought.ownComponentCarried).toBe(true);
    // Заклинание без материального компонента о нём молчит.
    expect(row("shield").card.components.material).toBeUndefined();
  });

  it("заметка игрока едет строкой; ненаписанной нет вовсе", () => {
    expect(row("shield").note).toBeUndefined();

    const noted = row("shield", createThorne(), [
      { kind: "set_spell_note", spellId: "shield", note: "гасит и стрелу" },
    ]);
    expect(noted.note).toBe("гасит и стрелу");
  });
});

describe("способы сотворения", () => {
  it("у заговора способ один и без оплаты, и сам он назван заговором", () => {
    const shown = row("ray-of-frost");

    expect(shown.cantrip).toBe(true);
    expect(shown.castOptions).toEqual([
      expect.objectContaining({ mode: "cantrip", payment: { kind: "none" }, suggested: true }),
    ]);
  });

  it("урон едет по каждой ячейке, а не по уровню заклинания", () => {
    // «Молния» третьего уровня: своей ячейкой 8d6, четвёртой — на кость больше.
    const damage = row("lightning-bolt").castOptions.map((option) => option.damage?.formula);

    expect(damage).toContain("8d6");
    expect(damage).toContain("9d6");
  });

  it("способ кровью называет уровень и цену в хитах", () => {
    const byLevel = (id: string, castLevel: number) =>
      row(id).castOptions.find(
        (option) => option.payment.kind === "blood" && option.castLevel === castLevel,
      );

    // Цена уровня — 2, 5 и 6 единиц, курс Торна — три хита за единицу.
    expect(byLevel("mage-armor", 1)).toMatchObject({ hitPointCost: 6 });
    expect(byLevel("lightning-bolt", 3)).toMatchObject({ hitPointCost: 15 });
    expect(byLevel("lightning-bolt", 4)).toMatchObject({ hitPointCost: 18 });
  });

  it("ритуальный способ называет, на сколько он длиннее обычного", () => {
    const ritual = row("detect-magic").castOptions.find((option) => option.mode === "ritual");

    expect(ritual?.extraMinutes).toBe(10);
  });

  it("вердикт стоит у каждого способа: потраченная ячейка не запрещает соседнюю", () => {
    const spent = withSpentSlots(createThorne(), 1, 4);
    const options = row("mage-armor", spent).castOptions;
    const bySlot = (level: number) =>
      options.find(
        (option) => option.payment.kind === "slot" && option.payment.slotLevel === level,
      );

    expect(bySlot(1)?.available).toBe(false);
    expect(bySlot(1)?.warnings[0]?.code).toBe("no_slot");
    expect(bySlot(2)?.available).toBe(true);
  });

  it("шаги мастера решаются признаками строки, а не разбором карточки на экране", () => {
    expect(row("arcane-vigor").spendsHitDice).toBe(true);
    expect(row("mage-armor").spendsHitDice).toBe(false);
    // Компонент «Волшебного замка» — золотая пыль за 25 зм: фокусировка их не заменяет; само
    // заклинание отложено, и книга дописывается прогоном.
    const knows = knowing(createThorne(), "arcane-lock");
    expect(row("arcane-lock", knows).ownComponentRequired).toBe(true);
    expect(row("arcane-lock", knows).componentReminders.join(" ")).toContain("золотая пыль");
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

describe("общая причина названа один раз (FR-305)", () => {
  /** Ход, в котором действие уже истрачено: им закрыто всё, что действием платит. */
  function afterSpendingTheAction(): LiveSession {
    return played(createThorne(), [
      ...START,
      { kind: "cast_spell", spellId: "ray-of-frost", mode: "cantrip", payment: { kind: "none" } },
    ]);
  }

  it("пока ход цел, общей причины нет вовсе", () => {
    expect(toSpellsRefusal(played(createThorne(), START))).toBeUndefined();
  });

  it("истраченное действие названо причиной списка, а не причиной каждой строки", () => {
    const live = afterSpendingTheAction();
    const rows = toSpellRowViews(live);
    const closed = rows.filter((candidate) => candidate.unavailable);

    // Строк, закрытых ходом, много — фраза о нём одна.
    expect(closed.length).toBeGreaterThan(1);
    expect(toSpellsRefusal(live)).toBe("Действие уже израсходовано");
    expect(closed.map((candidate) => candidate.unavailableReason)).not.toContain(
      "Действие уже израсходовано",
    );
  });

  it("недоступность строки видна и без её собственной фразы", () => {
    const closed = toSpellRowViews(afterSpendingTheAction()).filter(
      (candidate) => candidate.unavailable && candidate.unavailableReason === undefined,
    );

    expect(closed.length).toBeGreaterThan(0);
  });

  it("своя причина строки остаётся при ней: её общей фразой не объяснить", () => {
    const reason = row("mage-armor", withoutAnyPayment()).unavailableReason;

    expect(reason).toBeDefined();
  });
});
