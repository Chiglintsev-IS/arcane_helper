import { castSpell } from "@/core/application/useCases/casting";
import { beforeEach, describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { ALL_TURN_RESOURCES } from "@/core/application/casting/availability";
import {
  createCastDraftStore,
  RECENT_TARGETS_LIMIT,
  toCastRequest,
  visibleSteps,
  type CastDraft,
  type DraftContext,
} from "@/ui/features/cast-spell/model/castDraftStore";
import { testClock } from "@/ui/app/testing/stores";
import { createSession, type Session } from "@/core/application/session";

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

function context(
  character: CharacterState = createThorne(),
  turn: Partial<typeof ALL_TURN_RESOURCES> = {},
): DraftContext {
  // Бой идёт и ход считается: этот файл проверяет черновик мастера, а не факт начала боя.
  return { character, turn: { ...ALL_TURN_RESOURCES, inFight: true, tracksTurn: true, ...turn } };
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
    testClock(),
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
    store.getState().start(mageArmor, context());
    store.getState().chooseRune("war");

    expect(draftOf().rune).toBe("war");
    expect(toCastRequest(draftOf()).rune).toBe("war");
  });

  it("повторное нажатие снимает руну: выбор без возможности передумать — ловушка", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseRune("life");
    store.getState().chooseRune("life");

    expect(draftOf().rune).toBeNull();
    expect(toCastRequest(draftOf()).rune).toBeUndefined();
  });

  it("выбор другой руны заменяет прежнюю: больше одной на заклинание не бывает", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseRune("life");
    store.getState().chooseRune("wind");

    expect(draftOf().rune).toBe("wind");
  });

  it("смена оплаты на ритуал снимает руну: ритуал её не принимает", () => {
    store.getState().start(detectMagic, context({ ...createThorne(), screenMode: "camp" }));
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
    store.getState().chooseRune("war");
    expect(draftOf().rune).toBe("war");

    store.getState().chooseCastOption({ mode: "ritual", payment: { kind: "none" } });
    expect(draftOf().rune).toBeNull();
  });

  it("без черновика выбор руны ничего не делает", () => {
    store.getState().chooseRune("war");
    expect(store.getState().draft).toBeNull();
  });
});

describe("начало применения", () => {
  it("подготовленное заклинание начинается с ячейки своего уровня и первого видимого шага", () => {
    store.getState().start(mageArmor, context());

    expect(draftOf()).toMatchObject({
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
      step: "slot",
      allowAnyway: false,
      targetLabel: null,
    });
  });

  it("заклинание на себя начинается с выбора ячейки", () => {
    store.getState().start(shield, context());
    expect(draftOf().step).toBe("slot");
  });

  it("заговор не выбирает ячейку", () => {
    store.getState().start(rayOfFrost, context());
    expect(draftOf()).toMatchObject({ mode: "cantrip", payment: { kind: "none" } });
  });

  it("неподготовленный ритуал начинается как ритуал: так его и сотворяют (FR-103)", () => {
    // Вне боя: в бою ритуального способа нет вовсе, +10 минут в раунд не помещаются.
    store.getState().start(identify, context(createThorne(), { tracksTurn: false, inFight: false }));
    expect(draftOf()).toMatchObject({ mode: "ritual", payment: { kind: "none" } });
  });

  it("в бою тот же ритуал начинается ячейкой (FR-208)", () => {
    store.getState().start(detectMagic, context());
    expect(draftOf()).toMatchObject({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
  });

  it("отмена стирает черновик", () => {
    store.getState().start(mageArmor, context());
    store.getState().cancel();
    expect(store.getState().draft).toBeNull();
  });
});

describe("шаги мастера (FR-021, M-03)", () => {
  it("типовое боевое заклинание проходится за два шага", () => {
    store.getState().start(mageArmor, context());
    expect(visibleSteps(draftOf(), context())).toEqual(["slot", "summary"]);
  });

  it("заговор применяется одним экраном: выбирать нечего", () => {
    store.getState().start(rayOfFrost, context());
    expect(visibleSteps(draftOf(), context())).toEqual(["summary"]);
  });

  it("цель мастер не спрашивает: ввод текста в бою слишком медленный (OQ-10)", () => {
    store.getState().start(rayOfFrost, context());
    const steps: string[] = [...visibleSteps(draftOf(), context())];
    expect(steps).not.toContain("target");
  });

  it("нарушенное условие добавляет шаг проверки доступности первым", () => {
    const spent = context();
    store.getState().start(mageArmor, { ...spent, turn: { ...ALL_TURN_RESOURCES, actionAvailable: false } });

    expect(
      visibleSteps(draftOf(), { ...spent, turn: { ...ALL_TURN_RESOURCES, actionAvailable: false } }),
    ).toEqual(["availability", "slot", "summary"]);
    expect(draftOf().step).toBe("availability");
  });

  it("концентрационное заклинание само по себе шага не добавляет: заменять нечего", () => {
    store.getState().start(detectMagic, context());
    expect(visibleSteps(draftOf(), context())).not.toContain("concentration");
  });

  it("занятая концентрация добавляет шаг замены (FR-081)", () => {
    const busy = concentrating();
    store.getState().start(detectMagic, context(busy));
    expect(visibleSteps(draftOf(), context(busy))).toContain("concentration");
  });

  it("компонент со стоимостью добавляет шаг проверки компонентов", () => {
    store.getState().start(identify, context());
    expect(visibleSteps(draftOf(), context())).toContain("components");
  });

  it("компоненты без стоимости отдельного шага не требуют: выбирать нечего", () => {
    store.getState().start(mageArmor, context());
    expect(visibleSteps(draftOf(), context())).not.toContain("components");
  });
});

describe("навигация по шагам", () => {
  it("вперёд и назад ходят только по видимым шагам", () => {
    store.getState().start(mageArmor, context());
    const steps = visibleSteps(draftOf(), context());

    store.getState().next(steps);
    expect(draftOf().step).toBe("summary");
    store.getState().back(steps);
    expect(draftOf().step).toBe("slot");
  });

  it("на последнем шаге вперёд не уходит, на первом — назад", () => {
    store.getState().start(mageArmor, context());
    const steps = visibleSteps(draftOf(), context());

    store.getState().back(steps);
    expect(draftOf().step).toBe("slot");

    for (const _ of steps) store.getState().next(steps);
    expect(draftOf().step).toBe("summary");
  });

  it("без черновика навигация ничего не делает", () => {
    store.getState().next(["summary"]);
    store.getState().back(["summary"]);
    store.getState().setTarget("гоблин");
    store.getState().allowAnyway();
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "spell_points" } });
    store.getState().setRoleplayCategory("sarcastic");
    expect(store.getState().draft).toBeNull();
  });
});

describe("запоминание выбора (F-03)", () => {
  it("повторное применение предлагает прежний уровень ячейки", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "slot", slotLevel: 3 } });
    store.getState().cancel();

    store.getState().start(mageArmor, context());
    expect(draftOf().payment).toEqual({ kind: "slot", slotLevel: 3 });
  });

  it("запомненный уровень не переносится на другое заклинание", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "slot", slotLevel: 4 } });
    store.getState().cancel();

    store.getState().start(shield, context());
    expect(draftOf().payment).toEqual({ kind: "slot", slotLevel: 1 });
  });

  it("запомненный способ оплаты, которого больше нет, заменяется доступным", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "slot", slotLevel: 4 } });
    store.getState().cancel();

    // Персонаж потерял ячейки 4 уровня — например, состояние пришло из другого сохранения.
    const weaker = createThorne();
    const { 4: _lost, ...rest } = weaker.spellSlots;
    weaker.spellSlots = rest;

    store.getState().start(mageArmor, context(weaker));
    expect(draftOf().payment).toEqual({ kind: "slot", slotLevel: 1 });
  });

  it("без свободных ячеек предлагает ячейку своего уровня, чтобы шаг доступности объяснил причину", () => {
    const spent = createThorne();
    const empty: CharacterState["spellSlots"] = {};
    for (const [level, slot] of Object.entries(spent.spellSlots)) {
      empty[Number(level)] = { ...slot, remaining: 0 };
    }
    spent.spellSlots = empty;

    store.getState().start(mageArmor, context(spent));
    expect(draftOf().payment).toEqual({ kind: "slot", slotLevel: 1 });
    expect(visibleSteps(draftOf(), context(spent))).toContain("availability");
  });

  it("заклинание уровня, до которого персонаж не дорос, оплаты не предлагает", () => {
    const ninthLevel: Spell = { ...mageArmor, level: 9 };
    store.getState().start(ninthLevel, context());
    expect(draftOf().payment).toEqual({ kind: "none" });
  });

  it("запоминает категорию отыгрыша", () => {
    store.getState().start(mageArmor, context());
    store.getState().setRoleplayCategory("sarcastic");
    store.getState().cancel();

    store.getState().start(mageArmor, context());
    expect(draftOf().roleplayCategory).toBe("sarcastic");
  });

  it("оплату кровью тоже запоминает", () => {
    store.getState().start(mageArmor, context());
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "spell_points" } });
    store.getState().cancel();

    store.getState().start(mageArmor, context());
    expect(draftOf().payment).toEqual({ kind: "spell_points" });
  });
});

describe("цель свободным текстом (OQ-10)", () => {
  it("сохраняет недавние цели без повторов и новые сверху", () => {
    store.getState().start(rayOfFrost, context());
    store.getState().setTarget("гоблин у двери");
    store.getState().setTarget("огр");
    store.getState().setTarget("гоблин у двери");

    expect(store.getState().recentTargets).toEqual(["гоблин у двери", "огр"]);
    expect(draftOf().targetLabel).toBe("гоблин у двери");
  });

  it("список недавних целей не растёт бесконечно", () => {
    store.getState().start(rayOfFrost, context());
    for (let index = 0; index <= RECENT_TARGETS_LIMIT; index += 1) {
      store.getState().setTarget(`цель ${index}`);
    }
    expect(store.getState().recentTargets).toHaveLength(RECENT_TARGETS_LIMIT);
  });

  it("пустая строка цель снимает и в недавние не попадает", () => {
    store.getState().start(rayOfFrost, context());
    store.getState().setTarget("огр");
    store.getState().setTarget("   ");

    expect(draftOf().targetLabel).toBeNull();
    expect(store.getState().recentTargets).toEqual(["огр"]);
  });
});

describe("заявка на применение", () => {
  it("собирает заявку из черновика", () => {
    store.getState().start(mageArmor, context());
    store.getState().setTarget("на себя");
    store.getState().allowAnyway();

    expect(toCastRequest(draftOf())).toEqual({
      spell: mageArmor,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
      targetLabel: "на себя",
      allowAnyway: true,
    });
  });

  it("без цели поля цели в заявке нет", () => {
    store.getState().start(shield, context());
    expect(toCastRequest(draftOf())).not.toHaveProperty("targetLabel");
  });
});

describe("инвариант FR-022: до подтверждения состояние не меняется", () => {
  it("полный проход мастера не трогает ни персонажа, ни журнал", () => {
    const session: Session = createSession(createThorne());
    const before = structuredClone(session);

    store.getState().start(mageArmor, context(session.character));
    const steps = visibleSteps(draftOf(), context(session.character));
    store.getState().chooseCastOption({ mode: "normal", payment: { kind: "slot", slotLevel: 2 } });
    store.getState().setTarget("на себя");
    store.getState().setRoleplayCategory("atmospheric");
    store.getState().allowAnyway();
    for (const _ of steps) store.getState().next(steps);
    toCastRequest(draftOf());

    expect(session).toEqual(before);
  });
});
