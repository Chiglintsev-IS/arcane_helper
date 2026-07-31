import { beforeEach, describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import { characterStateSchema } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import {
  actionUsedBy,
  beginTurn,
  bloodCostFor,
  castSpell,
  createSession,
  deriveTurnEconomy,
  endConcentration,
  endEffect,
  exchangeBlood,
  grantTemporaryHitPoints,
  heal,
  JOURNAL_LIMIT,
  longRest,
  recoverHitPointMaximum,
  refundSpellSlot,
  regenerationDue,
  SessionError,
  setScreenMode,
  setSpellNote,
  setSunlight,
  shortRest,
  spendRuneOnWardingSigil,
  takeDamage,
  undoLast,
  useArcaneRecovery,
  wardingSigilAvailable,
  type Session,
} from "./session";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/** Детерминированные часы: чистые функции время не изобретают. */
function testClock() {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

let clock: ReturnType<typeof testClock>;
let session: Session;

beforeEach(() => {
  clock = testClock();
  session = createSession(createThorne());
});

/**
 * Учёт хода ведётся ровно в режиме «Бой» (FR-143), а он же начальный, — поэтому помощник ничего не
 * включает. Оставлен именем: он объясняет, зачем тесту вообще учёт.
 */
function withTurnTracking(base: Session): Session {
  return { ...base, character: { ...base.character, screenMode: "combat" } };
}

/** Вне боя: ходов нет, значит и расходовать в них нечего (FR-143). */
function outOfCombat(base: Session): Session {
  return { ...base, character: { ...base.character, screenMode: "camp" } };
}

describe("начальное состояние Торна", () => {
  it("проходит схему и содержит подтверждённые числа", () => {
    const thorne = createThorne();
    expect(characterStateSchema.safeParse(thorne).success).toBe(true);
    expect(thorne.spellSaveDc).toBe(16);
    expect(thorne.spellAttackModifier).toBe(8);
    expect(thorne.constitutionSaveModifier).toBe(4);
    expect(thorne.hitPoints).toEqual({ current: 60, maximum: 60, maximumReduction: 0 });
    expect(thorne.runes).toEqual({ maximum: 3, remaining: 3 });
    expect(thorne.spellSlots[1]?.maximum).toBe(4);
    expect(thorne.spellSlots[4]?.maximum).toBe(1);
  });

  it("каждый вызов даёт независимый объект", () => {
    const first = createThorne();
    first.hitPoints.current = 1;
    expect(createThorne().hitPoints.current).toBe(60);
  });

  it("ритуалы не входят в подготовленные (FR-103)", () => {
    const thorne = createThorne();
    for (const id of ["find-familiar", "detect-magic", "identify", "unseen-servant"]) {
      expect(thorne.preparedSpellIds).not.toContain(id);
      expect(thorne.spellbookSpellIds).toContain(id);
    }
  });
});

describe("применение заклинания (FR-023)", () => {
  it("списывает ячейку и заводит эффект", () => {
    const after = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.spellSlots[1]?.remaining).toBe(3);
    expect(after.character.activeEffects).toHaveLength(1);
    expect(after.character.activeEffects[0]?.nameRu).toBe("Доспехи мага");
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.summaryRu).toBe("Доспехи мага — ячейкой 1 уровня");
  });

  it("одно применение — одна запись журнала", () => {
    const after = castSpell(
      session,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.kind).toBe("reaction_cast");
  });

  it("заговор не расходует ячейку (FR-072)", () => {
    const after = castSpell(
      session,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" }, targetLabel: "гоблин" },
      clock,
    );
    expect(after.character.spellSlots).toEqual(session.character.spellSlots);
    expect(after.journal[0]?.summaryRu).toBe("Луч холода — заговором");
  });

  it("ритуал не расходует ячейку (FR-073)", () => {
    const after = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "ritual", payment: { kind: "none" } },
      clock,
    );
    expect(after.character.spellSlots).toEqual(session.character.spellSlots);
    expect(after.journal[0]?.summaryRu).toBe("Обнаружение магии — ритуалом");
  });

  it("отклоняет оплату ячейкой для заговора и ритуала", () => {
    expect(() =>
      castSpell(
        session,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "slot", slotLevel: 1 } },
        clock,
      ),
    ).toThrow(/Заговор не расходует ячейку/);
    expect(() =>
      castSpell(
        session,
        { spell: spell("identify"), mode: "ritual", payment: { kind: "slot", slotLevel: 1 } },
        clock,
      ),
    ).toThrow(/Ритуальное применение не расходует ячейку/);
  });

  it("отклоняет ячейку ниже уровня заклинания", () => {
    const highLevel: Spell = { ...spell("shield"), level: 3 };
    expect(() =>
      castSpell(session, { spell: highLevel, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    ).toThrow(/ниже уровня заклинания/);
  });

  it("требует способа оплаты для заклинания с ячейкой", () => {
    expect(() =>
      castSpell(session, { spell: spell("shield"), mode: "normal", payment: { kind: "none" } }, clock),
    ).toThrow(/требует способа оплаты/);
  });

  it("мгновенное заклинание эффекта не создаёт", () => {
    const instant: Spell = { ...spell("shield"), duration: { type: "instant" } };
    const after = castSpell(
      session,
      { spell: instant, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.activeEffects).toHaveLength(0);
  });

  it("«Применить всё равно» пускает ячейку в минус (FR-031)", () => {
    let current = session;
    current = castSpell(
      current,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
      clock,
    );
    expect(current.character.spellSlots[4]?.remaining).toBe(0);
    expect(() =>
      castSpell(
        current,
        { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
        clock,
      ),
    ).toThrow(/Нет свободной ячейки/);
    const forced = castSpell(
      current,
      {
        spell: spell("shield"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 4 },
        allowAnyway: true,
      },
      clock,
    );
    expect(forced.character.spellSlots[4]?.remaining).toBe(-1);
  });
});

describe("экономия действий (FR-141)", () => {
  it("расходует действие, бонусное действие и реакцию", () => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(current.character.turnTracking.actionAvailable).toBe(false);

    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(current.character.reactionAvailable).toBe(false);

    const bonus: Spell = { ...spell("disguise-self"), castingTime: { type: "bonus_action" } };
    current = castSpell(
      current,
      { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(current.character.turnTracking.bonusActionAvailable).toBe(false);
  });

  it.each([
    ["действие", "mage-armor", /Действие уже израсходовано/],
    ["реакцию", "shield", /Реакция уже израсходована/],
  ])("не даёт потратить %s дважды", (_what, id, expected) => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell(id), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(() =>
      castSpell(
        current,
        { spell: spell(id), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
        clock,
      ),
    ).toThrow(expected);
  });

  it("не даёт потратить бонусное действие дважды", () => {
    const bonus: Spell = { ...spell("disguise-self"), castingTime: { type: "bonus_action" } };
    let current = withTurnTracking(session);
    current = castSpell(current, { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock);
    expect(() =>
      castSpell(current, { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
    ).toThrow(/Бонусное действие уже израсходовано/);
  });

  it("вне боя действие не расходуется (FR-143)", () => {
    let current = outOfCombat(session);
    for (let index = 0; index < 3; index += 1) {
      current = castSpell(
        current,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
        clock,
      );
    }
    expect(current.character.turnTracking.actionAvailable).toBe(true);
  });

  it("время «минута» и «час» действие не расходуют", () => {
    const current = castSpell(
      withTurnTracking(session),
      { spell: spell("find-familiar"), mode: "ritual", payment: { kind: "none" } },
      clock,
    );
    expect(current.character.turnTracking.actionAvailable).toBe(true);
  });

  it("начало хода восстанавливает действие и реакцию (FR-140)", () => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    current = beginTurn(current, clock);
    expect(current.character.reactionAvailable).toBe(true);
    expect(current.character.turnTracking.actionAvailable).toBe(true);
  });
});

describe("истечение эффекта в раундах (FR-094)", () => {
  const castShield = (base: Session): Session =>
    castSpell(
      base,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );

  it("начало хода снимает истёкшее: «Щит» держится один раунд", () => {
    const shielded = castShield(withTurnTracking(session));
    expect(shielded.character.activeEffects).toHaveLength(1);

    const next = beginTurn(shielded, clock);
    expect(next.character.activeEffects).toEqual([]);
    expect(next.journal.at(-1)?.summaryRu).toContain("«Щит» истёк");
  });

  it("снятие обратимо: ошибка возвращается отменой (FR-111)", () => {
    const next = beginTurn(castShield(withTurnTracking(session)), clock);
    expect(undoLast(next).character.activeEffects).toHaveLength(1);
  });

  it("эффект в минутах начало хода не трогает: часов приложение не считает", () => {
    // «Обнаружение магии» — 10 минут: сколько времени прошло между ходами, приложение не знает.
    const casting = castSpell(
      withTurnTracking(session),
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(beginTurn(casting, clock).character.activeEffects).toHaveLength(1);
  });

  it("эффект на несколько раундов переживает свой первый ход", () => {
    const shield = spell("shield");
    const threeRounds: Spell = { ...shield, duration: { type: "rounds", value: 3 } };
    let current = castSpell(
      withTurnTracking(session),
      { spell: threeRounds, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );

    current = beginTurn(current, clock);
    expect(current.character.activeEffects).toHaveLength(1);
    current = beginTurn(current, clock);
    expect(current.character.activeEffects).toHaveLength(1);
    current = beginTurn(current, clock);
    expect(current.character.activeEffects).toEqual([]);
  });

  it("истёкшая концентрация заканчивается вместе с эффектом (FR-083)", () => {
    // Концентрация и эффект разойтись не могут: схема состояния такого и не пропустит.
    const detectMagic = spell("detect-magic");
    const brief: Spell = { ...detectMagic, duration: { type: "rounds", value: 1 } };
    const casting = castSpell(
      withTurnTracking(session),
      { spell: brief, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(casting.character.concentration).toBeDefined();

    const next = beginTurn(casting, clock);
    expect(next.character.activeEffects).toEqual([]);
    expect(next.character.concentration).toBeUndefined();
    expect(characterStateSchema.safeParse(next.character).success).toBe(true);
  });
});

describe("концентрация (FR-080, FR-081)", () => {
  const concentrating = () => spell("detect-magic");

  it("запуск концентрации создаёт эффект и фиксирует её", () => {
    const after = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.concentration?.spellId).toBe("detect-magic");
    expect(after.character.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(1);
  });

  it("вторая концентрация без подтверждения отклоняется", () => {
    const first = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(() =>
      castSpell(
        first,
        { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
        clock,
      ),
    ).toThrow(/замена требует отдельного подтверждения/);
  });

  it("подтверждённая замена оставляет ровно одну концентрацию (UC-03)", () => {
    const first = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    const replaced = castSpell(
      first,
      {
        spell: { ...concentrating(), id: "other-concentration", nameRu: "Другое" },
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
        allowAnyway: true,
      },
      clock,
    );
    expect(replaced.character.concentration?.spellId).toBe("other-concentration");
    expect(replaced.character.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(1);
  });

  it.each(["manual", "failed_check", "replaced", "long_rest"] as const)(
    "завершение по причине «%s» снимает и концентрацию, и эффект",
    (reason) => {
      const started = castSpell(
        session,
        { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
        clock,
      );
      const ended = endConcentration(started, reason, clock);
      expect(ended.character.concentration).toBeUndefined();
      expect(ended.character.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(0);
      expect(ended.journal.at(-1)?.kind).toBe("concentration_ended");
    },
  );

  it("завершать нечего, если концентрации нет", () => {
    expect(() => endConcentration(session, "manual", clock)).toThrow(SessionError);
  });
});

describe("«Знаки ограждения» (FR-153, FR-154)", () => {
  it("доступны при наличии руны и реакции", () => {
    expect(wardingSigilAvailable(session.character)).toBe(true);
  });

  it("тратят руну и реакцию", () => {
    const after = spendRuneOnWardingSigil(session, clock);
    expect(after.character.runes.remaining).toBe(2);
    expect(after.character.reactionAvailable).toBe(false);
    expect(after.journal.at(-1)?.kind).toBe("rune_spent");
  });

  it("недоступны без реакции", () => {
    const spent = spendRuneOnWardingSigil(session, clock);
    expect(wardingSigilAvailable(spent.character)).toBe(false);
    expect(() => spendRuneOnWardingSigil(spent, clock)).toThrow(/Реакция уже израсходована/);
  });

  it("недоступны без рун", () => {
    const drained: Session = {
      ...session,
      character: { ...session.character, runes: { maximum: 3, remaining: 0 } },
    };
    expect(wardingSigilAvailable(drained.character)).toBe(false);
    expect(() => spendRuneOnWardingSigil(drained, clock)).toThrow(/Рун не осталось/);
  });

  it("спасают концентрацию: провал проверки можно не доводить до конца", () => {
    const started = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    const saved = spendRuneOnWardingSigil(started, clock);
    expect(saved.character.concentration?.spellId).toBe("detect-magic");
    expect(saved.character.runes.remaining).toBe(2);
  });
});

describe("руна при сотворении (FR-151)", () => {
  it("тратится вместе с ячейкой", () => {
    const after = castSpell(
      session,
      {
        spell: spell("mage-armor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
        rune: "war",
      },
      clock,
    );
    expect(after.character.runes.remaining).toBe(2);
  });

  it("не применяется к оплате кровью", () => {
    const withPoints: Session = {
      ...session,
      character: {
        ...session.character,
        spellPoints: { remaining: 5, createdAt: clock.now() },
      },
    };
    expect(() =>
      castSpell(
        withPoints,
        {
          spell: spell("shield"),
          mode: "normal",
          payment: { kind: "spell_points" },
          rune: "life",
        },
        clock,
      ),
    ).toThrow(/только к заклинанию, оплаченному ячейкой/);
  });

  it("отклоняется, когда рун не осталось", () => {
    const drained: Session = {
      ...session,
      character: { ...session.character, runes: { maximum: 3, remaining: 0 } },
    };
    expect(() =>
      castSpell(
        drained,
        {
          spell: spell("mage-armor"),
          mode: "normal",
          payment: { kind: "slot", slotLevel: 1 },
          rune: "wind",
        },
        clock,
      ),
    ).toThrow(/Рун не осталось/);
  });
});

describe("кровавое колдовство (FR-170…FR-174)", () => {
  it("цена заклинания в хитах соответствует ступени Торна", () => {
    expect(bloodCostFor(session.character, 1)).toBe(6);
    expect(bloodCostFor(session.character, 3)).toBe(15);
  });

  it("обменивает хиты на очки и снижает максимум", () => {
    const after = exchangeBlood(session, 9, clock);
    expect(after.character.spellPoints.remaining).toBe(3);
    expect(after.character.hitPoints).toEqual({
      current: 51,
      maximum: 51,
      maximumReduction: 9,
    });
    expect(after.journal.at(-1)?.kind).toBe("blood_exchange");
  });

  it("не тратит остаток, не дающий очка", () => {
    const after = exchangeBlood(session, 10, clock);
    expect(after.character.spellPoints.remaining).toBe(3);
    expect(after.character.hitPoints.current).toBe(51);
  });

  it("отклоняет обмен, которого не хватает на очко", () => {
    expect(() => exchangeBlood(session, 2, clock)).toThrow(/не хватает даже на одно очко/);
  });

  it("отклоняет обмен дороже текущего здоровья", () => {
    const weak: Session = {
      ...session,
      character: {
        ...session.character,
        hitPoints: { current: 5, maximum: 60, maximumReduction: 0 },
      },
    };
    expect(() => exchangeBlood(weak, 9, clock)).toThrow(/в наличии 5/);
  });

  it("расходует действие при включённом учёте хода", () => {
    const after = exchangeBlood(withTurnTracking(session), 9, clock);
    expect(after.character.turnTracking.actionAvailable).toBe(false);
  });

  it("оплачивает заклинание очками", () => {
    const withPoints = exchangeBlood(session, 6, clock);
    const cast = castSpell(
      withPoints,
      { spell: spell("shield"), mode: "normal", payment: { kind: "spell_points" } },
      clock,
    );
    expect(cast.character.spellPoints.remaining).toBe(0);
    expect(cast.character.spellSlots[1]?.remaining).toBe(4);
    expect(cast.journal.at(-1)?.summaryRu).toContain("кровью, 2 очков");
  });

  it("отклоняет оплату, когда очков не хватает", () => {
    expect(() =>
      castSpell(session, { spell: spell("shield"), mode: "normal", payment: { kind: "spell_points" } }, clock),
    ).toThrow(/Очков заклинаний 0, нужно 2/);
  });

  it("подавлено уроном огнём и солнцем (FR-176)", () => {
    const burned = takeDamage(session, 7, clock, { fire: true });
    expect(() => exchangeBlood(burned, 9, clock)).toThrow(/подавлено уроном огнём/);

    const sunlit = setSunlight(session, true, clock);
    expect(() => exchangeBlood(sunlit, 9, clock)).toThrow(/под прямым солнечным светом/);
  });

  it("подавление обходится явным разрешением", () => {
    const burned = takeDamage(session, 7, clock, { fire: true });
    expect(exchangeBlood(burned, 9, clock, { allowAnyway: true }).character.spellPoints.remaining).toBe(3);
  });
});

describe("урон, подавление и регенерация (FR-180…FR-182)", () => {
  it("урон уменьшает хиты и не уходит ниже нуля", () => {
    expect(takeDamage(session, 70, clock).character.hitPoints.current).toBe(0);
  });

  it("огненный урон подавляет особенности до начала хода", () => {
    const burned = takeDamage(session, 5, clock, { fire: true });
    expect(burned.character.suppression.firedUpon).toBe(true);
    expect(burned.journal.at(-1)?.summaryRu).toContain("огонь");
    expect(beginTurn(burned, clock).character.suppression.firedUpon).toBe(false);
  });

  it.each([0, -3, 1.5])("отклоняет урон %s", (damage) => {
    expect(() => takeDamage(session, damage, clock)).toThrow(SessionError);
  });

  it("признак солнца переключается и не переключается впустую", () => {
    const sunlit = setSunlight(session, true, clock);
    expect(sunlit.character.suppression.underDirectSunlight).toBe(true);
    expect(() => setSunlight(sunlit, true, clock)).toThrow(/уже в этом состоянии/);
    expect(setSunlight(sunlit, false, clock).character.suppression.underDirectSunlight).toBe(false);
  });

  it("регенерация действует только ниже половины максимума и без подавления", () => {
    expect(regenerationDue(session.character)).toBe(0);
    const wounded = takeDamage(session, 40, clock);
    expect(regenerationDue(wounded.character)).toBe(3);
    const burned = takeDamage(wounded, 1, clock, { fire: true });
    expect(regenerationDue(burned.character)).toBe(0);
    const downed = takeDamage(wounded, 100, clock);
    expect(regenerationDue(downed.character)).toBe(0);
  });

  it("порог регенерации считается от снижённого максимума", () => {
    const exchanged = exchangeBlood(session, 30, clock);
    // Максимум стал 30, текущее 30 — половина не пройдена.
    expect(regenerationDue(exchanged.character)).toBe(0);
    const wounded = takeDamage(exchanged, 20, clock);
    expect(regenerationDue(wounded.character)).toBe(3);
  });
});

describe("отдых и восстановление", () => {
  it("долгий отдых восстанавливает ячейки, руны и снимает концентрацию (FR-130)", () => {
    let current = castSpell(
      session,
      {
        spell: spell("detect-magic"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        rune: "life",
      },
      clock,
    );
    current = exchangeBlood(current, 9, clock);
    current = longRest(current, clock);

    expect(current.character.spellSlots[2]?.remaining).toBe(3);
    expect(current.character.runes.remaining).toBe(3);
    expect(current.character.concentration).toBeUndefined();
    expect(current.character.spellPoints).toEqual({ remaining: 0, createdAt: null });
    expect(current.character.arcaneRecoveryAvailable).toBe(true);
  });

  it("долгий отдых сохраняет эффекты с особой длительностью", () => {
    const special: Spell = { ...spell("mage-armor"), duration: { type: "special" } };
    let current = castSpell(
      session,
      { spell: special, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    current = longRest(current, clock);
    expect(current.character.activeEffects).toHaveLength(1);
  });

  it("короткий отдых ячейки не восстанавливает (FR-132)", () => {
    let current = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    current = shortRest(current, clock);
    expect(current.character.spellSlots[1]?.remaining).toBe(3);
    expect(current.character.reactionAvailable).toBe(true);
  });

  it("магическое восстановление работает один раз до долгого отдыха (FR-131)", () => {
    let current = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    current = useArcaneRecovery(current, { 1: 1 }, clock);
    expect(current.character.spellSlots[1]?.remaining).toBe(4);
    expect(current.character.arcaneRecoveryAvailable).toBe(false);
    expect(() => useArcaneRecovery(current, { 1: 1 }, clock)).toThrow(/уже использовано/);
  });

  it("магическое восстановление не превышает бюджет", () => {
    let current = outOfCombat(session);
    for (const level of [3, 2] as const) {
      current = castSpell(
        current,
        { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: level } },
        clock,
      );
    }
    expect(() => useArcaneRecovery(current, { 3: 1, 2: 1 }, clock)).toThrow(/превышает бюджет 4/);
  });

  it("возврат ошибочной ячейки (FR-071)", () => {
    let current = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 2 } },
      clock,
    );
    current = refundSpellSlot(current, 2, clock);
    expect(current.character.spellSlots[2]?.remaining).toBe(3);
    expect(current.journal.at(-1)?.kind).toBe("slot_refunded");
  });
});

describe("активные эффекты (FR-091)", () => {
  it("ручное завершение убирает эффект", () => {
    const cast = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    const effectId = cast.character.activeEffects[0]?.id ?? "";
    const ended = endEffect(cast, effectId, clock);
    expect(ended.character.activeEffects).toHaveLength(0);
  });

  it("завершение концентрационного эффекта снимает и концентрацию", () => {
    const cast = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    const effectId = cast.character.activeEffects[0]?.id ?? "";
    const ended = endEffect(cast, effectId, clock);
    expect(ended.character.concentration).toBeUndefined();
  });

  it("отклоняет неизвестный эффект", () => {
    expect(() => endEffect(session, "нет-такого", clock)).toThrow(SessionError);
  });
});

describe("отмена последнего действия (FR-111)", () => {
  it("возвращает состояние побитово", () => {
    const before = structuredClone(session.character);
    const after = castSpell(
      session,
      {
        spell: spell("detect-magic"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        rune: "war",
      },
      clock,
    );
    const undone = undoLast(after);
    expect(undone.character).toEqual(before);
    expect(undone.journal).toHaveLength(0);
  });

  it.each([
    ["применение заговора", (s: Session) => castSpell(s, { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } }, clock)],
    ["кровавое колдовство", (s: Session) => exchangeBlood(s, 9, clock)],
    ["урон", (s: Session) => takeDamage(s, 12, clock, { fire: true })],
    ["солнце", (s: Session) => setSunlight(s, true, clock)],
    ["руну на знаки ограждения", (s: Session) => spendRuneOnWardingSigil(s, clock)],
    ["долгий отдых", (s: Session) => longRest(exchangeBlood(s, 9, clock), clock)],
    // Отдых обязан что-то восстанавливать, иначе случай ничего не проверяет:
    // сначала тратим реакцию и руну, потом отдыхаем.
    ["короткий отдых", (s: Session) => shortRest(spendRuneOnWardingSigil(s, clock), clock)],
    ["начало хода", (s: Session) => beginTurn(takeDamage(s, 5, clock, { fire: true }), clock)],
  ])("отменяет %s", (_name, operation) => {
    const start = session;
    const changed = operation(start);
    let current = changed;
    while (current.journal.length > 0) current = undoLast(current);
    expect(current.character).toEqual(start.character);
  });

  it("отмена долгого отдыха возвращает и ячейки, и концентрацию", () => {
    let current = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 3 } },
      clock,
    );
    const beforeRest = structuredClone(current.character);
    current = longRest(current, clock);
    current = undoLast(current);
    expect(current.character).toEqual(beforeRest);
  });

  it("пустой журнал отменять нечего", () => {
    expect(() => undoLast(session)).toThrow(/Журнал пуст/);
  });

  it("многократная отмена идёт по одному действию назад", () => {
    let current = outOfCombat(session);
    const snapshots = [structuredClone(current.character)];
    for (const level of [1, 2, 3] as const) {
      current = castSpell(
        current,
        { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: level } },
        clock,
      );
      snapshots.push(structuredClone(current.character));
    }
    for (let index = snapshots.length - 1; index > 0; index -= 1) {
      current = undoLast(current);
      expect(current.character).toEqual(snapshots[index - 1]);
    }
  });
});

describe("журнал (FR-110, FR-112)", () => {
  it("событие без изменения ресурсов всё равно записывается", () => {
    // Заговор вне боя не тратит ничего, но FR-110 требует записать применение.
    const before = outOfCombat(session);
    const after = castSpell(
      before,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
      clock,
    );
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.undoPatch).toEqual({});
    expect(after.character).toEqual(before.character);
  });

  it("отмена записи без изменений убирает только строку журнала", () => {
    const after = castSpell(
      session,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
      clock,
    );
    const undone = undoLast(after);
    expect(undone.journal).toHaveLength(0);
    expect(undone.character).toEqual(session.character);
  });

  it("не растёт бесконечно", () => {
    let current = outOfCombat(session);
    for (let index = 0; index < JOURNAL_LIMIT + 15; index += 1) {
      current = castSpell(
        current,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" }, targetLabel: `цель ${index}` },
        clock,
      );
      current = { ...current, character: { ...current.character, activeEffects: [] } };
    }
    expect(current.journal).toHaveLength(JOURNAL_LIMIT);
  });

  it("записи содержат идентификатор заклинания и уровень ячейки", () => {
    const after = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 3 } },
      clock,
    );
    expect(after.journal[0]).toMatchObject({ spellId: "mage-armor", slotLevel: 3 });
  });
});

describe("экономия хода выводится из журнала (ADR-0008, FR-144)", () => {
  it("до первой отметки хода считает всё доступным", () => {
    const economy = deriveTurnEconomy(withTurnTracking(session));
    expect(economy).toMatchObject({ started: false, reactionAvailable: true, round: 1 });
  });

  it("вне боя всё доступно независимо от журнала", () => {
    let current = beginTurn(outOfCombat(session), clock);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("считает раунды по отметкам начала хода", () => {
    let current = withTurnTracking(session);
    expect(deriveTurnEconomy(current).round).toBe(1);
    for (const expected of [1, 2, 3]) {
      current = beginTurn(current, clock);
      expect(deriveTurnEconomy(current).round).toBe(expected);
    }
  });

  it("реакция, потраченная после начала хода, недоступна и сообщает когда вернётся", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);

    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    const economy = deriveTurnEconomy(current);
    expect(economy.reactionAvailable).toBe(false);
    expect(economy.reactionReturns).toBe("в начале вашего хода");
  });

  it("реакция возвращается началом следующего хода, а не концом раунда", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    // Между ходами происходят другие события — реакция всё ещё потрачена.
    current = takeDamage(current, 4, clock);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);

    current = beginTurn(current, clock);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("«Знаки ограждения» тратят реакцию так же, как заклинание-реакция", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = spendRuneOnWardingSigil(current, clock);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);
    expect(current.journal.at(-1)?.actionUsed).toBe("reaction");
  });

  it("отмена реакции возвращает доступность без отдельной логики", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    current = undoLast(current);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("кровавое колдовство расходует действие в терминах журнала", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = exchangeBlood(current, 9, clock);
    expect(current.journal.at(-1)?.actionUsed).toBe("action");
    expect(deriveTurnEconomy(current).actionAvailable).toBe(false);
  });

  it("ритуал ничего не тратит внутри хода", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = castSpell(
      current,
      { spell: spell("find-familiar"), mode: "ritual", payment: { kind: "none" } },
      clock,
    );
    expect(current.journal.at(-1)?.actionUsed).toBeUndefined();
    expect(deriveTurnEconomy(current).actionAvailable).toBe(true);
  });

  it("вывод и флаги состояния не расходятся", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    const steps: Array<(s: Session) => Session> = [
      (s) => castSpell(s, { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
      (s) => castSpell(s, { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, clock),
      (s) => beginTurn(s, clock),
    ];
    for (const step of steps) {
      current = step(current);
      const economy = deriveTurnEconomy(current);
      expect(economy.reactionAvailable).toBe(current.character.reactionAvailable);
      expect(economy.actionAvailable).toBe(current.character.turnTracking.actionAvailable);
      expect(economy.bonusActionAvailable).toBe(
        current.character.turnTracking.bonusActionAvailable,
      );
    }
  });

  it("actionUsedBy определяет вид траты по времени накладывания", () => {
    expect(actionUsedBy(spell("shield"))).toBe("reaction");
    expect(actionUsedBy(spell("mage-armor"))).toBe("action");
    expect(actionUsedBy(spell("find-familiar"))).toBeUndefined();
    expect(actionUsedBy({ ...spell("mage-armor"), castingTime: { type: "bonus_action" } })).toBe(
      "bonus_action",
    );
    expect(actionUsedBy({ ...spell("mending"), castingTime: { type: "minute" } })).toBeUndefined();
  });
});

describe("регенерация тролля начисляется в начале хода (FR-182)", () => {
  it("восстанавливает хиты и пишет величину в журнал", () => {
    let current = takeDamage(session, 40, clock);
    expect(current.character.hitPoints.current).toBe(20);
    current = beginTurn(current, clock);
    expect(current.character.hitPoints.current).toBe(23);
    expect(current.journal.at(-1)?.summaryRu).toBe("Начало хода · регенерация +3");
  });

  it("не начисляет выше половины максимума", () => {
    const current = beginTurn(session, clock);
    expect(current.character.hitPoints.current).toBe(60);
    expect(current.journal.at(-1)?.summaryRu).toBe("Начало хода");
  });

  it("не начисляет под подавлением огнём", () => {
    let current = takeDamage(session, 40, clock);
    current = takeDamage(current, 1, clock, { fire: true });
    const before = current.character.hitPoints.current;
    current = beginTurn(current, clock);
    expect(current.character.hitPoints.current).toBe(before);
  });

  it("не начисляет под солнцем", () => {
    let current = takeDamage(session, 40, clock);
    current = setSunlight(current, true, clock);
    const before = current.character.hitPoints.current;
    current = beginTurn(current, clock);
    expect(current.character.hitPoints.current).toBe(before);
  });

  it("не поднимает с нуля хитов", () => {
    let current = takeDamage(session, 60, clock);
    current = beginTurn(current, clock);
    expect(current.character.hitPoints.current).toBe(0);
  });

  it("не превышает максимум", () => {
    const nearlyFull: Session = {
      ...session,
      character: {
        ...session.character,
        hitPoints: { current: 2, maximum: 4, maximumReduction: 56 },
      },
    };
    // 2 из 4 — не ниже половины, регенерация не идёт.
    expect(beginTurn(nearlyFull, clock).character.hitPoints.current).toBe(2);

    const low: Session = {
      ...session,
      character: {
        ...session.character,
        hitPoints: { current: 1, maximum: 4, maximumReduction: 56 },
      },
    };
    expect(beginTurn(low, clock).character.hitPoints.current).toBe(4);
  });

  it("начисление отменяется вместе с началом хода", () => {
    const wounded = takeDamage(session, 40, clock);
    const before = structuredClone(wounded.character);
    const undone = undoLast(beginTurn(wounded, clock));
    expect(undone.character).toEqual(before);
  });
});

describe("активный эффект без указанной длительности", () => {
  it("создаётся с типом длительности, но без значения", () => {
    const vague: Spell = { ...spell("mage-armor"), duration: { type: "rounds" } };
    const after = castSpell(
      session,
      { spell: vague, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.activeEffects[0]?.duration).toEqual({ type: "rounds" });
  });

  it("особая длительность переносится как есть", () => {
    const special: Spell = { ...spell("mage-armor"), duration: { type: "special" } };
    const after = castSpell(
      session,
      { spell: special, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.activeEffects[0]?.duration).toEqual({ type: "special" });
  });

  it("эффект не на себя получает тип «utility»", () => {
    const onOther: Spell = {
      ...spell("mage-armor"),
      targeting: { type: "creature", maximumTargets: 1 },
    };
    const after = castSpell(
      session,
      { spell: onOther, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.activeEffects[0]?.type).toBe("utility");
  });

  it("эффект на себя получает тип «buff»", () => {
    const onSelf: Spell = { ...spell("mage-armor"), targeting: { type: "self" } };
    const after = castSpell(
      session,
      { spell: onSelf, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(after.character.activeEffects[0]?.type).toBe("buff");
  });
});

describe("режим экрана (FR-200, FR-204)", () => {
  it("меняется без записи в журнал: отменять в виде нечего", () => {
    const after = setScreenMode(session, "camp");
    expect(after.character.screenMode).toBe("camp");
    expect(after.journal).toHaveLength(0);
  });

  it("повторный выбор того же режима возвращает ту же сессию", () => {
    expect(setScreenMode(session, "combat")).toBe(session);
  });
});

describe("обмен крови вне боя действие не расходует (FR-143, FR-170)", () => {
  it("на привале хиты уходят, а кэш действия остаётся нетронутым", () => {
    const after = exchangeBlood(outOfCombat(session), 6, clock);
    expect(after.character.spellPoints.remaining).toBe(2);
    expect(after.character.turnTracking.actionAvailable).toBe(true);
  });
});

describe("правка хитов: лечение и временные (FR-205, FR-206)", () => {
  function hurt(current: number): Session {
    return { ...session, character: { ...session.character, hitPoints: { current, maximum: 60, maximumReduction: 0 } } };
  }

  it("лечение поднимает текущие хиты и пишется в журнал", () => {
    const after = heal(hurt(40), 12, clock);
    expect(after.character.hitPoints.current).toBe(52);
    expect(after.journal.at(-1)?.summaryRu).toBe("Вылечено: 12");
  });

  it("выше максимума не поднимает и говорит об этом", () => {
    const after = heal(hurt(55), 20, clock);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Вылечено: 5 (из 20: упёрлись в максимум)");
  });

  it("упирается в снижённый максимум, а не в исходный (FR-172)", () => {
    const reduced: Session = {
      ...session,
      character: { ...session.character, hitPoints: { current: 40, maximum: 60, maximumReduction: 9 } },
    };
    expect(heal(reduced, 30, clock).character.hitPoints.current).toBe(51);
  });

  it("на полном здоровье отказывает, а не пишет пустую запись", () => {
    expect(() => heal(session, 5, clock)).toThrow(/уже на максимуме/);
  });

  it.each([0, -3, 1.5])("отклоняет недопустимое лечение %s", (amount) => {
    expect(() => heal(hurt(40), amount, clock)).toThrow(SessionError);
  });

  it("временные хиты записываются отдельным числом", () => {
    const after = grantTemporaryHitPoints(session, 8, clock);
    expect(after.character.temporaryHitPoints).toBe(8);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Временные хиты: 8");
  });

  it("не складываются: меньшее значение отклоняется", () => {
    const granted = grantTemporaryHitPoints(session, 8, clock);
    expect(() => grantTemporaryHitPoints(granted, 5, clock)).toThrow(/не складываются/);
    expect(grantTemporaryHitPoints(granted, 10, clock).character.temporaryHitPoints).toBe(10);
  });

  it.each([0, -1, 2.5])("отклоняет недопустимое значение %s", (amount) => {
    expect(() => grantTemporaryHitPoints(session, amount, clock)).toThrow(SessionError);
  });

  it("урон идёт сначала по временным хитам", () => {
    const granted = grantTemporaryHitPoints(session, 8, clock);
    const after = takeDamage(granted, 5, clock);
    expect(after.character.temporaryHitPoints).toBe(3);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Получено урона: 5, из них 5 временными хитами");
  });

  it("остаток урона сверх временных хитов бьёт по текущим", () => {
    const granted = grantTemporaryHitPoints(session, 8, clock);
    const after = takeDamage(granted, 20, clock);
    expect(after.character.temporaryHitPoints).toBe(0);
    expect(after.character.hitPoints.current).toBe(48);
  });

  it("лечение временные хиты не восстанавливает", () => {
    const spent = takeDamage(grantTemporaryHitPoints(hurt(40), 8, clock), 20, clock);
    expect(spent.character.temporaryHitPoints).toBe(0);
    expect(heal(spent, 10, clock).character.temporaryHitPoints).toBe(0);
  });

  it("долгий отдых снимает временные хиты", () => {
    const granted = grantTemporaryHitPoints(session, 8, clock);
    expect(longRest(granted, clock).character.temporaryHitPoints).toBe(0);
  });
});

describe("окончание эффекта называет срок числом (FR-090)", () => {
  function endCondition(spellOverride: Partial<Spell>): string | undefined {
    const subject: Spell = { ...spell("mage-armor"), ...spellOverride };
    const after = castSpell(
      session,
      { spell: subject, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    return after.character.activeEffects[0]?.endConditionRu;
  }

  it("короткий срок переводится в раунды: за столом считают ими", () => {
    expect(endCondition({ duration: { type: "minutes", value: 1 } })).toBe(
      "Держится до 1 минуты (10 раундов).",
    );
  });

  it("длинному сроку раунды не приписываются: их не пересчитать в уме", () => {
    expect(endCondition({ duration: { type: "hours", value: 8 } })).toBe("Держится до 8 часов.");
  });

  it("концентрация названа вместе со сроком, а не вместо него", () => {
    expect(
      endCondition({ duration: { type: "minutes", value: 10 }, concentration: true }),
    ).toBe("Держится до 10 минут или до конца концентрации.");
  });

  it("особой длительности срок не приписывается", () => {
    expect(endCondition({ duration: { type: "special" } })).toBe("Длительность особая.");
    expect(endCondition({ duration: { type: "special" }, concentration: true })).toBe(
      "До конца концентрации; длительность особая.",
    );
  });
});

describe("заметка к заклинанию (FR-012)", () => {
  it("сохраняется в состоянии и не попадает в журнал", () => {
    const after = setSpellNote(session, "shield", "мастер считает, что щит гасит и «Волшебную стрелу»");

    expect(after.character.spellNotes.shield).toBe(
      "мастер считает, что щит гасит и «Волшебную стрелу»",
    );
    // Заметка не меняет игровое состояние, поэтому журнал не засоряет (F-10).
    expect(after.journal).toHaveLength(0);
  });

  it("заменяет прежнюю заметку того же заклинания", () => {
    const once = setSpellNote(session, "shield", "первая");
    expect(setSpellNote(once, "shield", "вторая").character.spellNotes.shield).toBe("вторая");
  });

  it("сохраняет пробелы внутри и в конце: заметка пишется посимвольно", () => {
    const after = setSpellNote(session, "shield", "гасит ");
    expect(after.character.spellNotes.shield).toBe("гасит ");
  });

  it("пустая заметка удаляет запись, а не хранит пустую строку", () => {
    const once = setSpellNote(session, "shield", "первая");
    const cleared = setSpellNote(once, "shield", "   ");

    expect(cleared.character.spellNotes).toEqual({});
    expect(characterStateSchema.safeParse(cleared.character).success).toBe(true);
  });
})


describe("почасовое восстановление максимума хитов (FR-173)", () => {
  function afterExchange(): Session {
    return exchangeBlood(session, 9, clock);
  }

  it("возвращает не больше, чем утрачено кровавым колдовством", () => {
    const spent = afterExchange();
    expect(spent.character.hitPoints).toEqual({ current: 51, maximum: 51, maximumReduction: 9 });

    const recovered = recoverHitPointMaximum(spent, clock);
    // На 7 уровне возвращается 3 за час (rules-engine.md#регенерация-и-восстановление).
    expect(recovered.character.hitPoints).toEqual({
      current: 51,
      maximum: 54,
      maximumReduction: 6,
    });
  });

  it("последний час возвращает только остаток", () => {
    let state = exchangeBlood(session, 6, clock);
    state = recoverHitPointMaximum(state, clock);
    expect(state.character.hitPoints).toEqual({ current: 54, maximum: 57, maximumReduction: 3 });

    state = recoverHitPointMaximum(state, clock);
    expect(state.character.hitPoints).toEqual({ current: 54, maximum: 60, maximumReduction: 0 });
  });

  it("без снижения максимума восстанавливать нечего", () => {
    expect(() => recoverHitPointMaximum(session, clock)).toThrow(SessionError);
  });

  it("под подавлением не работает: ни солнце, ни огонь восстановления не дают", () => {
    const spent = setSunlight(afterExchange(), true, clock);
    expect(() => recoverHitPointMaximum(spent, clock)).toThrow(/солнеч/);

    const burned = takeDamage(afterExchange(), 5, clock, { fire: true });
    expect(() => recoverHitPointMaximum(burned, clock)).toThrow(/огн/);
  });

  it("обратимо через журнал", () => {
    const recovered = recoverHitPointMaximum(afterExchange(), clock);
    expect(undoLast(recovered).character.hitPoints.maximumReduction).toBe(9);
  });
})

describe("схема ритуала не влияет на механику (FR-193)", () => {
  it("подмена схемы не меняет результат применения", () => {
    const ritual = spell("unseen-servant");
    const diagram = ritual.ritualDiagram;
    if (diagram === undefined) throw new Error("у «Незримого слуги» нет схемы");
    const repainted: Spell = {
      ...ritual,
      ritualDiagram: {
        ...diagram,
        captionRu: "Другая подпись",
        centralSeal: { kind: "sphere", radius: 0.2 },
      },
    };
    const request = { mode: "ritual", payment: { kind: "none" } } as const;

    // Двое одинаковых часов вместо одних общих: идентификаторы и время у обоих применений
    // совпадают, и сравнение идёт по существу, а не по счётчику.
    const original = castSpell(session, { spell: ritual, ...request }, testClock());
    const other = castSpell(session, { spell: repainted, ...request }, testClock());

    expect(other.character).toEqual(original.character);
    expect(other.journal.map((entry) => entry.summaryRu)).toEqual(
      original.journal.map((entry) => entry.summaryRu),
    );
  });
});
