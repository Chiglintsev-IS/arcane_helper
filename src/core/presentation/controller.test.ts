/**
 * Перевод команд в вызовы сценариев.
 *
 * Здесь проверяется именно перевод: что команда доходит до своего сценария и что слово, которого в
 * правилах нет, отвергается с причиной. Сами правила проверяются у своих владельцев — повторять их
 * здесь значило бы завести вторую копию, которая разойдётся с настоящей.
 */

import { describe, expect, it } from "vitest";

import type { Command } from "@/contract/commands";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createSession, type LiveSession, type Occasion } from "@/core/application/session";
import { Character } from "@/core/domain/assembly/character";

import { applyCommand } from "./controller";

const CATALOG = loadThorneSpells();
const PARTS = { builtInCatalog: CATALOG, createInitialCharacter: createThorne };

function occasion(commandId: string): Occasion {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 9, 12, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
    commandId,
  };
}

function start(): LiveSession {
  return {
    session: createSession(createThorne()),
    spellCatalog: CATALOG,
    spellCatalogSource: "built_in",
  };
}

/** Цепочка команд: каждая своей попыткой, иначе вторая сочлась бы повтором первой. */
let attempts = 0;

function run(commands: readonly Command[], from: LiveSession = start()): LiveSession {
  return commands.reduce(
    (live, command) => applyCommand(live, command, occasion(`command-${++attempts}`), PARTS),
    from,
  );
}

function refusal(commands: readonly Command[]): string {
  try {
    run(commands);
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("команда прошла, а должна была отказать");
}

const cast = (spellId: string, slotLevel: number): Command => ({
  kind: "cast_spell",
  spellId,
  mode: "normal",
  payment: { kind: "slot", slotLevel },
});

describe("ход и схватка", () => {
  it("начало боя, новый ход и конец боя записываются", () => {
    const live = run([{ kind: "start_combat" }, { kind: "begin_turn" }, { kind: "end_combat" }]);

    expect(live.session.log.map((entry) => entry.kind)).toEqual([
      "combat_started",
      "turn_started",
      "combat_ended",
    ]);
  });
});

describe("ресурсы", () => {
  it("ячейка тратится и возвращается", () => {
    const spent = run([{ kind: "spend_spell_slot", slotLevel: 1 }]);
    expect(spent.session.character.spellSlots[1]?.remaining).toBe(3);

    const back = run([{ kind: "refund_spell_slot", slotLevel: 1 }], spent);
    expect(back.session.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("руны правятся числом со знаком", () => {
    const live = run([{ kind: "adjust_runes", delta: -1 }]);

    expect(live.session.character.runes.remaining).toBe(2);
  });

  it("последняя подсказка тратится тем же числом со знаком", () => {
    const live = run([{ kind: "adjust_last_hint", delta: -1 }]);

    expect(live.session.character.lastHint.remaining).toBe(0);
  });
});

describe("жизнеспособность", () => {
  it("урон, лечение и временные хиты доходят до своих сценариев", () => {
    const live = run([
      { kind: "take_damage", damage: 10 },
      { kind: "heal", amount: 4 },
      { kind: "grant_temporary_hit_points", amount: 5 },
    ]);

    expect(live.session.character.hitPoints.current).toBe(54);
    expect(live.session.character.temporaryHitPoints).toBe(5);
  });

  it("огонь подавляет особенности: признак доезжает до сценария", () => {
    const live = run([{ kind: "take_damage", damage: 6, fire: true }]);

    expect(live.session.log[0]?.summaryRu).toMatch(/огонь/);
  });

  it("плата кровью и возврат максимума", () => {
    const paid = run([
      { kind: "cast_spell", spellId: "shield", mode: "normal", payment: { kind: "blood", castLevel: 1 } },
    ]);
    expect(paid.session.character.hitPoints.bloodReduction).toBeGreaterThan(0);

    const recovered = run([{ kind: "recover_hit_point_maximum" }], paid);
    expect(recovered.session.log.at(-1)?.kind).toBe("hit_points_changed");
  });

  it("солнечный свет отмечается", () => {
    const live = run([{ kind: "set_sunlight", underSunlight: true }]);

    expect(live.session.log[0]?.kind).toBe("suppression_changed");
  });
});

describe("отдых", () => {
  it("короткий отдых записывается", () => {
    const live = run([{ kind: "short_rest" }]);

    expect(live.session.log[0]?.kind).toBe("short_rest");
  });

  it("магическое восстановление принимает уровни ключами", () => {
    const live = run([
      { kind: "spend_spell_slot", slotLevel: 1 },
      { kind: "short_rest" },
      { kind: "use_arcane_recovery", plan: { 1: 1 } },
    ]);

    expect(live.session.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("уровень ячейки не числом отвергается с причиной", () => {
    expect(
      refusal([{ kind: "short_rest" }, { kind: "use_arcane_recovery", plan: { первый: 1 } }]),
    ).toMatch(/уровень ячейки/);
  });
});

describe("эффекты и концентрация", () => {
  it("ручной эффект заводится и снимается", () => {
    const started = run([{ kind: "start_manual_effect", nameRu: "Ослеплён" }]);
    const effect = started.session.character.activeEffects[0];
    expect(effect?.nameRu).toBe("Ослеплён");

    const ended = run([{ kind: "end_effect", effectId: effect!.id }], started);
    expect(ended.session.character.activeEffects).toHaveLength(0);
  });

  it("ручной эффект несёт вклад в защиту, когда он назван", () => {
    const before = Character.of(start().session.character).sheet.value("armorClass");
    const live = run([{ kind: "start_manual_effect", nameRu: "Прикрытие", armorClassBonus: 2 }]);

    expect(Character.of(live.session.character).sheet.value("armorClass")).toBe(before + 2);
  });

  it("поправка к КД ставится и снимается нулём", () => {
    const set = run([{ kind: "set_armor_class_adjustment", value: 3 }]);
    expect(Character.of(set.session.character).effects.manualAdjustment("armorAdjustment")).toBe(3);

    const cleared = run([{ kind: "set_armor_class_adjustment", value: 0 }], set);
    expect(
      Character.of(cleared.session.character).effects.manualAdjustment("armorAdjustment"),
    ).toBe(0);
  });

  it("концентрация завершается названной причиной", () => {
    const live = run([cast("web", 2), { kind: "end_concentration", reason: "failed_check" }]);

    expect(live.session.log.at(-1)?.summaryRu).toMatch(/провалена проверка/);
  });

  it("причина конца концентрации не из списка отвергается", () => {
    expect(refusal([cast("web", 2), { kind: "end_concentration", reason: "надоело" }])).toMatch(
      /причина конца концентрации/,
    );
  });

  it("руна тратится на «Знаки ограждения»", () => {
    const live = run([cast("web", 2), { kind: "spend_rune_on_warding_sigil" }]);

    expect(live.session.character.runes.remaining).toBe(2);
  });
});

describe("книга", () => {
  it("подготовка снимается и ставится", () => {
    const live = run([{ kind: "toggle_preparation", spellId: "mage-armor" }]);

    expect(live.session.character.preparedSpellIds).not.toContain("mage-armor");
  });

  it("компонент кладётся в сумку вещью", () => {
    const live = run([{ kind: "toggle_material", spellId: "arcane-lock" }]);

    expect(live.session.character.itemDefinitions.map((item) => item.nameRu)).toContain(
      "золотая пыль стоимостью минимум 25 зм, расходуемая заклинанием",
    );
  });

  it("заметка к заклинанию сохраняется и лога не касается", () => {
    const live = run([{ kind: "set_spell_note", spellId: "shield", note: "перед боем" }]);

    expect(live.session.character.spellNotes.shield).toBe("перед боем");
    expect(live.session.log).toHaveLength(0);
  });
});

describe("снаряжение", () => {
  const rope: Command = { kind: "add_item", nameRu: "Верёвка", itemKind: "other" };
  // Надеть можно только экипировку — верёвку носят в сумке, и это правило её контекста.
  const cloak: Command = { kind: "add_item", nameRu: "Плащ", itemKind: "gear" };

  /** Заведённая вещь среди прочих: у Торна есть своё снаряжение, и индекс здесь не годится. */
  function idOf(live: LiveSession, nameRu: string): string {
    const found = live.session.character.itemDefinitions.find((item) => item.nameRu === nameRu);
    if (found === undefined) throw new Error(`нет вещи «${nameRu}»`);
    return found.id;
  }

  it("вещь заводится, считается и снимается", () => {
    const added = run([cloak]);
    const id = idOf(added, "Плащ");

    const counted = run(
      [
        { kind: "adjust_bag_count", itemId: id, delta: 2 },
        { kind: "adjust_worn_count", itemId: id, delta: 1 },
      ],
      added,
    );
    // Надетое берётся из сумки: три в сумке минус один надетый — правило контекста снаряжения.
    expect(counted.session.character.equipment.bag.find((entry) => entry.itemId === id)?.count).toBe(2);
    expect(counted.session.character.equipment.worn.find((entry) => entry.itemId === id)?.count).toBe(1);

    // Снять вещь можно, когда её запас исчерпан: это правило контекста снаряжения.
    const removed = run(
      [
        { kind: "adjust_bag_count", itemId: id, delta: -1 },
        { kind: "remove_item", itemId: id },
      ],
      added,
    );
    expect(removed.session.character.itemDefinitions.map((item) => item.nameRu)).not.toContain(
      "Плащ",
    );
  });

  it("правка вещи проходит через объявление её контекста", () => {
    const added = run([rope]);
    const id = idOf(added, "Верёвка");

    const edited = run([{ kind: "edit_item", item: { id, nameRu: "Верёвка", kind: "other", note: "в сумке" } }], added);

    expect(edited.session.character.itemDefinitions.find((item) => item.id === id)?.note).toBe(
      "в сумке",
    );
  });

  it("вещь, не прошедшая объявления, отвергается с причиной", () => {
    const added = run([rope]);
    const id = idOf(added, "Верёвка");

    expect(() =>
      run(
        [{ kind: "edit_item", item: { id, nameRu: "Верёвка", kind: "other", bonuses: { armorClass: 1 } } }],
        added,
      ),
    ).toThrow(/не экипировка/);
  });

  it("категория вещи не из списка отвергается", () => {
    expect(refusal([{ kind: "add_item", nameRu: "Нечто", itemKind: "артефакт" }])).toMatch(
      /категория вещи/,
    );
  });

  it("кошелёк правится через своё объявление", () => {
    const live = run([{ kind: "edit_money", money: { gold: 12, silver: 3, copper: 0 } }]);

    expect(live.session.character.equipment.money.gold).toBe(12);
  });

  it("кошелёк с отрицательной монетой отвергается с причиной", () => {
    expect(refusal([{ kind: "edit_money", money: { gold: -1, silver: 0, copper: 0 } }])).toMatch(
      /кошелёк/,
    );
  });
});

describe("лист персонажа", () => {
  it("справочная правка доходит, а чужие поля отбрасываются", () => {
    const live = run([
      { kind: "edit_identity", patch: { name: "Торн Второй", spellSlots: { 1: { maximum: 9, remaining: 9 } } } },
    ]);

    expect(live.session.character.name).toBe("Торн Второй");
    // Правка листа — не дверь к ячейкам: чужое поле не прошло.
    expect(live.session.character.spellSlots[1]?.maximum).toBe(4);
  });

  it("характеристика правится вместе со своими владениями", () => {
    const live = run([
      {
        kind: "edit_ability",
        ability: "dexterity",
        score: 16,
        saveProficient: true,
        skills: { acrobatics: "expert" },
      },
    ]);

    expect(live.session.character.abilities.dexterity).toBe(16);
    expect(live.session.character.saveProficiencies).toContain("dexterity");
    expect(live.session.character.skills.acrobatics).toBe("expert");
  });

  it("характеристика не из списка отвергается", () => {
    expect(
      refusal([
        { kind: "edit_ability", ability: "удача", score: 10, saveProficient: false, skills: {} },
      ]),
    ).toMatch(/характеристика/);
  });

  it("навык не из списка отвергается", () => {
    expect(
      refusal([
        {
          kind: "edit_ability",
          ability: "dexterity",
          score: 14,
          saveProficient: false,
          skills: { жонглирование: "proficient" },
        },
      ]),
    ).toMatch(/навык/);
  });

  it("степень владения не из списка отвергается", () => {
    expect(
      refusal([
        {
          kind: "edit_ability",
          ability: "dexterity",
          score: 14,
          saveProficient: false,
          skills: { acrobatics: "мастерски" },
        },
      ]),
    ).toMatch(/владение навыком/);
  });

  it("отметки мастера и здоровье правятся", () => {
    const live = run([
      { kind: "edit_marks", exhaustion: 2, inspiration: true },
      { kind: "edit_health", maximumBase: 55, masterReduction: 0 },
    ]);

    expect(live.session.character.exhaustion).toBe(2);
    expect(live.session.character.inspiration).toBe(true);
    expect(live.session.character.hitPoints.maximumBase).toBe(55);
  });

  it("смена уровня двигает пулы", () => {
    const live = run([{ kind: "change_level", level: 8, hitPointMaximumBase: 66 }]);

    expect(live.session.character.level).toBe(8);
    expect(live.session.character.spellSlots[4]?.maximum).toBe(2);
  });
});

describe("сотворение", () => {
  it("руна и её цель доезжают до сценария", () => {
    const live = run([
      {
        kind: "cast_spell",
        spellId: "mage-armor",
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
        rune: "life",
        runeTarget: "other",
      },
    ]);

    expect(live.session.log[0]?.summaryRu).toMatch(/руна жизни/);
    expect(live.session.character.runes.remaining).toBe(2);
  });

  it("руна не из списка отвергается", () => {
    expect(
      refusal([
        {
          kind: "cast_spell",
          spellId: "mage-armor",
          mode: "normal",
          payment: { kind: "slot", slotLevel: 1 },
          rune: "победы",
        },
      ]),
    ).toMatch(/руна/);
  });

  it("цель руны не из списка отвергается", () => {
    expect(
      refusal([
        {
          kind: "cast_spell",
          spellId: "mage-armor",
          mode: "normal",
          payment: { kind: "slot", slotLevel: 1 },
          rune: "life",
          runeTarget: "всем",
        },
      ]),
    ).toMatch(/цель руны/);
  });

  it("исключение мастера и согласие на замену концентрации доезжают", () => {
    const live = run([
      cast("web", 2),
      {
        kind: "cast_spell",
        spellId: "detect-magic",
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
        allowAnyway: true,
        replaceConcentration: true,
      },
    ]);

    expect(live.session.character.concentration?.spellId).toBe("detect-magic");
  });
});

describe("ремесло", () => {
  const MOON_HERB = "Лунная трава";
  const CRIMSON_ROOT = "Багровый корень";

  /** Замысел в той форме, в какой он приходит с той стороны договора: словами справочника. */
  const formula = {
    kinds: [MOON_HERB, CRIMSON_ROOT],
    mainProperty: "Лечение здоровья",
    duration: null,
    onset: "Немедленно",
    fullRepeats: 0,
    reach: "Одна цель, предмет или участок",
    application: "Выпить, накормить или нанести на неподвижную цель",
    resistance: "Положительное воздействие на добровольную цель",
    purification: null,
    suppressed: [],
    limitations: [],
  };

  const stock: readonly Command[] = [
    { kind: "add_item", nameRu: MOON_HERB, itemKind: "ingredient" },
    { kind: "add_item", nameRu: CRIMSON_ROOT, itemKind: "ingredient" },
  ];

  it("замысел, собранный из слов справочника, доходит до изготовления", () => {
    const known = Character.of(createThorne());
    const withKnowledge = [MOON_HERB, CRIMSON_ROOT].reduce(
      (crafting, kind) =>
        crafting
          .noteIngredient(kind)
          .revealProperty(kind, { number: 1, nameRu: "Лечение здоровья", rarity: "common" }),
      known.crafting,
    );
    const live = run([...stock, { kind: "craft_batch", formula, portions: 1, rolled: 15 }], {
      session: createSession(known.withCrafting(withKnowledge).toState()),
      spellCatalog: CATALOG,
      spellCatalogSource: "built_in",
    });

    expect(live.session.log.at(-1)?.kind).toBe("batch_crafted");
  });

  it("вид записывается, свойство раскрывается, вид забывается", () => {
    const noted = run([
      { kind: "note_ingredient", nameRu: MOON_HERB },
      {
        kind: "reveal_property",
        nameRu: MOON_HERB,
        number: 1,
        propertyRu: "Лечение здоровья",
        rarity: "common",
      },
    ]);

    expect(noted.session.character.ingredientKnowledge[0]?.properties).toHaveLength(1);
    expect(run([{ kind: "forget_ingredient", nameRu: MOON_HERB }], noted).session.character
      .ingredientKnowledge).toEqual([]);
  });

  it("мастерская записывается командой и правит пределы работы", () => {
    const equipped = run([
      {
        kind: "set_alchemy_workshop",
        apparatus: { poisons: "Базовый лабораторный модуль" },
        studiedDirections: ["poisons"],
      },
    ]);

    expect(equipped.session.character.alchemyApparatus).toEqual({
      poisons: "Базовый лабораторный модуль",
    });
    expect(equipped.session.character.studiedDirections).toEqual(["poisons"]);
  });

  it("слово, которого нет в таблице справочника, отвергается с причиной", () => {
    expect(
      refusal([
        ...stock,
        {
          kind: "craft_batch",
          formula: { ...formula, onset: "когда-нибудь" },
          portions: 1,
          rolled: 15,
        },
      ]),
    ).toMatch(/начало действия/);
  });
});
