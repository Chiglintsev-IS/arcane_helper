/**
 * Черновик мастера применения.
 *
 * Способы сотворения приходят строкой заклинания, а не собираются здесь, поэтому и в прогоне они
 * настоящие: строка берётся у проекции ядра, собранной командами. Словарь чисел, набранный руками,
 * однажды разошёлся бы с тем, что приложение показывает игроку.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { Command } from "@/contract/commands";
import type { CastOptionView, SpellRowView } from "@/contract/views";
import { castSpell } from "@/core/application/useCases/casting";
import { withoutSlots } from "@/core/infrastructure/catalog/thorne/fixtures";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { applyCommand } from "@/core/presentation/controller";
import { answerQuestion } from "@/core/presentation/previewer";
import { toSpellRowViews } from "@/core/presentation/views/spellRowsView";
import {
  createCastDraftStore,
  RECENT_TARGETS_LIMIT,
  toCastCommand,
  visibleSteps,
  type CastDraft,
} from "@/ui/features/cast-spell/model/castDraftStore";
import { testClock } from "@/ui/app/testing/stores";
import { createSession, type LiveSession, type Session } from "@/core/application/session";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

const rayOfFrost = spell("ray-of-frost");
const mageArmor = spell("mage-armor");
const detectMagic = spell("detect-magic");
const identify = spell("identify");
const shield = spell("shield");

/** Бой идёт: этот файл проверяет черновик мастера, а не факт начала боя. */
const IN_FIGHT: readonly Command[] = [{ kind: "start_combat" }];

function played(
  character: CharacterState,
  commands: readonly Command[],
  catalog: readonly Spell[] = loadThorneSpells(),
): LiveSession {
  let live: LiveSession = {
    session: createSession(character),
    spellCatalog: catalog,
    spellCatalogSource: "built_in",
  };
  commands.forEach((command, index) => {
    live = applyCommand(
      live,
      command,
      { ...testClock(), commandId: `command-${index}` },
      { builtInCatalog: catalog, createInitialCharacter: () => character },
    );
  });
  return live;
}

/**
 * Выбирает ли руна цель — правило, и мастер узнаёт его предпросмотром. Здесь спрошено у того же
 * ответчика: угаданный флаг проверял бы догадку прогона, а не приложение.
 */
function choosesTarget(rune: string): boolean {
  const preview = answerQuestion(
    played(createThorne(), IN_FIGHT),
    { kind: "cast_preview", spellId: mageArmor.id, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
    testClock().now(),
  );
  if (preview.kind !== "cast_preview") throw new Error("ответчик ответил не про сотворение");
  const effect = preview.runes.effects.find((candidate) => candidate.rune === rune);
  if (effect === undefined) throw new Error(`нет эффекта руны ${rune}`);
  return effect.choosesTarget;
}

/** Строка заклинания так, как её увидит мастер применения. */
function rowOf(
  target: Spell,
  character: CharacterState = createThorne(),
  commands: readonly Command[] = IN_FIGHT,
  catalog?: readonly Spell[],
): SpellRowView {
  const rows = toSpellRowViews(played(character, commands, catalog ?? loadThorneSpells()));
  const found = rows.find((row) => row.id === target.id);
  if (found === undefined) throw new Error(`нет строки ${target.id}`);
  return found;
}

const OUTSIDE_FIGHT: readonly Command[] = [];

/** Способ оплаты ячейкой названного уровня. */
function slotOption(row: SpellRowView, slotLevel: number): CastOptionView {
  const found = row.castOptions.find(
    (option) => option.payment.kind === "slot" && option.payment.slotLevel === slotLevel,
  );
  if (found === undefined) throw new Error(`нет способа с ячейкой ${slotLevel}`);
  return found;
}

function optionBy(row: SpellRowView, match: (option: CastOptionView) => boolean): CastOptionView {
  const found = row.castOptions.find(match);
  if (found === undefined) throw new Error("нет такого способа");
  return found;
}

/**
 * Персонаж, который уже что-то держит. Собирается настоящим применением, а не вручную: схема
 * требует, чтобы у концентрации был соответствующий активный эффект, и фикстура, собранная руками,
 * однажды разошлась бы с тем, что порождает игра.
 */
function concentrating(): CharacterState {
  const session = castSpell(
    createSession(createThorne()),
    { spell: spell("web"), mode: "normal", payment: { kind: "slot", slotLevel: 2 } },
    { ...testClock(), commandId: "command-1" },
  );
  return session.character;
}

let store: ReturnType<typeof createCastDraftStore>;

beforeEach(() => {
  store = createCastDraftStore();
});

function draftOf(): CastDraft {
  const { draft } = store.getState();
  if (draft === null) throw new Error("черновика нет");
  return draft;
}

describe("руна при сотворении (FR-151)", () => {
  it("прикладывается к заклинанию и попадает в запрос применения", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().chooseRune("war", choosesTarget("war"));

    expect(draftOf().rune).toBe("war");
    expect(toCastCommand(draftOf()).rune).toBe("war");
  });

  it("повторное нажатие снимает руну: выбор без возможности передумать — ловушка", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().chooseRune("life", choosesTarget("life"));
    store.getState().chooseRune("life", choosesTarget("life"));

    expect(draftOf().rune).toBeNull();
    expect(toCastCommand(draftOf()).rune).toBeUndefined();
  });

  it("выбор другой руны заменяет прежнюю: больше одной на заклинание не бывает", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().chooseRune("life", choosesTarget("life"));
    store.getState().chooseRune("wind", choosesTarget("wind"));

    expect(draftOf().rune).toBe("wind");
  });

  it("смена оплаты на ритуал снимает руну: ритуал её не принимает", () => {
    const row = rowOf(detectMagic, createThorne(), OUTSIDE_FIGHT);
    store.getState().start(row);
    store.getState().chooseCastOption(slotOption(row, 1));
    store.getState().chooseRune("war", choosesTarget("war"));
    expect(draftOf().rune).toBe("war");

    store.getState().chooseCastOption(optionBy(row, (option) => option.mode === "ritual"));
    expect(draftOf().rune).toBeNull();
  });

  it("без черновика выбор руны ничего не делает", () => {
    store.getState().chooseRune("war", choosesTarget("war"));
    expect(store.getState().draft).toBeNull();
  });
});

describe("цель руны жизни (FR-156)", () => {
  it("по умолчанию себе, но переключается на другого и уходит в запрос", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().chooseRune("life", choosesTarget("life"));
    expect(draftOf().runeTarget).toBe("self");

    store.getState().chooseRuneTarget("other");
    expect(draftOf().runeTarget).toBe("other");
    expect(toCastCommand(draftOf()).runeTarget).toBe("other");
  });

  it("руна, цели не выбирающая, возвращает её себе: ветер действует только на заклинателя", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().chooseRune("life", choosesTarget("life"));
    store.getState().chooseRuneTarget("other");

    store.getState().chooseRune("wind", choosesTarget("wind"));
    expect(draftOf().runeTarget).toBe("self");
  });

  it("смена оплаты на ритуал возвращает цель к себе вместе с руной", () => {
    const row = rowOf(detectMagic, createThorne(), OUTSIDE_FIGHT);
    store.getState().start(row);
    store.getState().chooseCastOption(slotOption(row, 1));
    store.getState().chooseRune("life", choosesTarget("life"));
    store.getState().chooseRuneTarget("other");

    store.getState().chooseCastOption(optionBy(row, (option) => option.mode === "ritual"));
    expect(draftOf().runeTarget).toBe("self");
  });

  it("без черновика выбор цели ничего не делает", () => {
    store.getState().chooseRuneTarget("other");
    expect(store.getState().draft).toBeNull();
  });
});

describe("начало применения", () => {
  it("подготовленное заклинание начинается с ячейки своего уровня и первого видимого шага", () => {
    store.getState().start(rowOf(mageArmor));

    expect(draftOf()).toMatchObject({
      option: { mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      step: "slot",
      allowAnyway: false,
      targetLabel: null,
    });
  });

  it("заклинание на себя начинается с выбора ячейки", () => {
    store.getState().start(rowOf(shield));
    expect(draftOf().step).toBe("slot");
  });

  it("заговор не выбирает ячейку", () => {
    store.getState().start(rowOf(rayOfFrost));
    expect(draftOf().option).toMatchObject({ mode: "cantrip", payment: { kind: "none" } });
  });

  it("неподготовленный ритуал начинается как ритуал: так его и сотворяют (FR-103)", () => {
    // Вне боя: в бою ритуального способа нет вовсе, +10 минут в раунд не помещаются.
    store.getState().start(rowOf(identify, createThorne(), OUTSIDE_FIGHT));
    expect(draftOf().option).toMatchObject({ mode: "ritual", payment: { kind: "none" } });
  });

  it("в бою тот же ритуал начинается ячейкой (FR-208)", () => {
    store.getState().start(rowOf(detectMagic));
    expect(draftOf().option).toMatchObject({
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    });
  });

  it("отмена стирает черновик", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().cancel();
    expect(store.getState().draft).toBeNull();
  });
});

describe("шаги мастера (FR-021, M-03)", () => {
  it("типовое боевое заклинание проходится за два шага", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).toEqual(["slot", "summary"]);
  });

  it("заговор применяется одним экраном: выбирать нечего", () => {
    const row = rowOf(rayOfFrost);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).toEqual(["summary"]);
  });

  it("цель мастер не спрашивает: ввод текста в бою слишком медленный (OQ-10)", () => {
    const row = rowOf(rayOfFrost);
    store.getState().start(row);
    const steps: string[] = [...visibleSteps(draftOf(), row)];
    expect(steps).not.toContain("target");
  });

  it("нарушенное условие добавляет шаг проверки доступности первым", () => {
    // Действие уже израсходовано заговором: следующее заклинание объясняется этим первым шагом.
    const spent: readonly Command[] = [
      ...IN_FIGHT,
      { kind: "cast_spell", spellId: rayOfFrost.id, mode: "cantrip", payment: { kind: "none" } },
    ];
    const row = rowOf(mageArmor, createThorne(), spent);
    store.getState().start(row);

    expect(visibleSteps(draftOf(), row)).toEqual(["availability", "slot", "summary"]);
    expect(draftOf().step).toBe("availability");
  });

  it("концентрационное заклинание само по себе шага не добавляет: заменять нечего", () => {
    const row = rowOf(detectMagic);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).not.toContain("concentration");
  });

  it("занятая концентрация добавляет шаг замены (FR-081)", () => {
    const row = rowOf(detectMagic, concentrating());
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).toContain("concentration");
  });

  it("компонент со стоимостью добавляет шаг проверки компонентов", () => {
    const row = rowOf(identify);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).toContain("components");
  });

  it("компоненты без стоимости отдельного шага не требуют: выбирать нечего", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).not.toContain("components");
  });

  it("расход Костей хитов добавляет свой шаг", () => {
    const arcaneVigor = spell("arcane-vigor");
    const row = rowOf(arcaneVigor);
    store.getState().start(row);
    expect(visibleSteps(draftOf(), row)).toContain("hitDice");
  });
});

describe("навигация по шагам", () => {
  it("вперёд и назад ходят только по видимым шагам", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    const steps = visibleSteps(draftOf(), row);

    store.getState().next(steps);
    expect(draftOf().step).toBe("summary");
    store.getState().back(steps);
    expect(draftOf().step).toBe("slot");
  });

  it("на последнем шаге вперёд не уходит, на первом — назад", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    const steps = visibleSteps(draftOf(), row);

    store.getState().back(steps);
    expect(draftOf().step).toBe("slot");

    for (const _ of steps) store.getState().next(steps);
    expect(draftOf().step).toBe("summary");
  });

  it("без черновика навигация ничего не делает", () => {
    const row = rowOf(mageArmor);
    store.getState().next(["summary"]);
    store.getState().back(["summary"]);
    store.getState().setTarget("гоблин");
    store.getState().allowAnyway();
    store.getState().chooseCastOption(optionBy(row, (option) => option.payment.kind === "blood"));
    store.getState().setRoleplayCategory("sarcastic");
    store.getState().setHitDiceCount(1);
    store.getState().setHitDiceRolled(3);
    store.getState().replaceConcentration();
    expect(store.getState().draft).toBeNull();
  });
});

describe("запоминание выбора", () => {
  it("повторное применение предлагает прежний уровень ячейки", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    store.getState().chooseCastOption(slotOption(row, 3));
    store.getState().cancel();

    store.getState().start(row);
    expect(draftOf().option.payment).toEqual({ kind: "slot", slotLevel: 3 });
  });

  it("запомненный уровень не переносится на другое заклинание", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    store.getState().chooseCastOption(slotOption(row, 4));
    store.getState().cancel();

    store.getState().start(rowOf(shield));
    expect(draftOf().option.payment).toEqual({ kind: "slot", slotLevel: 1 });
  });

  it("запомненный способ оплаты, которого больше нет, заменяется предложенным", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    store.getState().chooseCastOption(slotOption(row, 4));
    store.getState().cancel();

    // Персонаж потерял ячейки 4 уровня — например, состояние пришло из другого сохранения.
    const thorne = createThorne();
    const { 4: _lost, ...withoutFourth } = thorne.spellSlots;
    const weaker = { ...thorne, spellSlots: withoutFourth };

    store.getState().start(rowOf(mageArmor, weaker));
    expect(draftOf().option.payment).toEqual({ kind: "slot", slotLevel: 1 });
  });

  it("без свободных ячеек предлагает кровь: она и есть доступный способ", () => {
    const spent = withoutSlots(createThorne());
    const row = rowOf(mageArmor, spent);

    store.getState().start(row);
    expect(draftOf().option.payment).toEqual({ kind: "blood", castLevel: 1 });
  });

  it("заклинание уровня, до которого персонаж не дорос, называет недостающую ячейку", () => {
    const ninthLevel: Spell = { ...mageArmor, level: 9 };
    const row = rowOf(ninthLevel, createThorne(), IN_FIGHT, [ninthLevel]);

    store.getState().start(row);
    expect(draftOf().option.payment).toEqual({ kind: "slot", slotLevel: 9 });
  });

  it("запоминает категорию отыгрыша", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    store.getState().setRoleplayCategory("sarcastic");
    store.getState().cancel();

    store.getState().start(row);
    expect(draftOf().roleplayCategory).toBe("sarcastic");
  });

  it("оплату кровью тоже запоминает", () => {
    const row = rowOf(mageArmor);
    store.getState().start(row);
    store
      .getState()
      .chooseCastOption(optionBy(row, (option) => option.payment.kind === "blood"));
    store.getState().cancel();

    store.getState().start(row);
    expect(draftOf().option.payment).toEqual({ kind: "blood", castLevel: 1 });
  });
});

describe("кости хитов в черновике", () => {
  const arcaneVigor = spell("arcane-vigor");

  it("смена числа костей обнуляет выпавшее: оно относилось к прежнему броску", () => {
    const row = rowOf(arcaneVigor);
    store.getState().start(row);
    store.getState().setHitDiceCount(2);
    store.getState().setHitDiceRolled(9);
    store.getState().setHitDiceCount(1);

    expect(draftOf().hitDiceRolled).toBeNull();
  });

  it("смена ячейки обнуляет оба поля: максимум зависит от её уровня", () => {
    const row = rowOf(arcaneVigor);
    store.getState().start(row);
    store.getState().setHitDiceCount(2);
    store.getState().setHitDiceRolled(9);
    store.getState().chooseCastOption(slotOption(row, 3));

    expect(draftOf()).toMatchObject({ hitDiceCount: null, hitDiceRolled: null });
  });

  it("брошенное уходит в заявку целиком, а недобранное не уходит вовсе", () => {
    const row = rowOf(arcaneVigor);
    store.getState().start(row);
    store.getState().setHitDiceCount(2);
    expect(toCastCommand(draftOf())).not.toHaveProperty("hitDice");

    store.getState().setHitDiceRolled(9);
    expect(toCastCommand(draftOf()).hitDice).toEqual({ count: 2, rolled: 9 });
  });
});

describe("цель свободным текстом (OQ-10)", () => {
  it("сохраняет недавние цели без повторов и новые сверху", () => {
    store.getState().start(rowOf(rayOfFrost));
    store.getState().setTarget("гоблин у двери");
    store.getState().setTarget("огр");
    store.getState().setTarget("гоблин у двери");

    expect(store.getState().recentTargets).toEqual(["гоблин у двери", "огр"]);
    expect(draftOf().targetLabel).toBe("гоблин у двери");
  });

  it("список недавних целей не растёт бесконечно", () => {
    store.getState().start(rowOf(rayOfFrost));
    for (let index = 0; index <= RECENT_TARGETS_LIMIT; index += 1) {
      store.getState().setTarget(`цель ${index}`);
    }
    expect(store.getState().recentTargets).toHaveLength(RECENT_TARGETS_LIMIT);
  });

  it("пустая строка цель снимает и в недавние не попадает", () => {
    store.getState().start(rowOf(rayOfFrost));
    store.getState().setTarget("огр");
    store.getState().setTarget("   ");

    expect(draftOf().targetLabel).toBeNull();
    expect(store.getState().recentTargets).toEqual(["огр"]);
  });
});

describe("заявка на применение", () => {
  it("собирает заявку из черновика", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().setTarget("на себя");
    store.getState().allowAnyway();

    expect(toCastCommand(draftOf())).toEqual({
      kind: "cast_spell",
      spellId: mageArmor.id,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
      targetLabel: "на себя",
      allowAnyway: true,
      replaceConcentration: false,
    });
  });

  it("исключение мастера не выдаёт согласия на замену концентрации", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().allowAnyway();

    expect(toCastCommand(draftOf()).replaceConcentration).toBe(false);
  });

  it("согласие на замену концентрации не выдаёт исключения мастера", () => {
    store.getState().start(rowOf(mageArmor));
    store.getState().replaceConcentration();

    const request = toCastCommand(draftOf());
    expect(request.replaceConcentration).toBe(true);
    expect(request.allowAnyway).toBe(false);
  });

  it("без цели поля цели в заявке нет", () => {
    store.getState().start(rowOf(shield));
    expect(toCastCommand(draftOf())).not.toHaveProperty("targetLabel");
  });
});

describe("инвариант FR-022: до подтверждения состояние не меняется", () => {
  it("полный проход мастера не трогает ни персонажа, ни журнал", () => {
    const session: Session = createSession(createThorne());
    const before = structuredClone(session);
    const row = rowOf(mageArmor, session.character);

    store.getState().start(row);
    const steps = visibleSteps(draftOf(), row);
    store.getState().chooseCastOption(slotOption(row, 2));
    store.getState().setTarget("на себя");
    store.getState().setRoleplayCategory("atmospheric");
    store.getState().allowAnyway();
    for (const _ of steps) store.getState().next(steps);
    toCastCommand(draftOf());

    expect(session).toEqual(before);
  });
});
