import { beforeEach, describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import { characterStateSchema } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import type { RoleplayCategory } from "@/store/castDraftStore";
import {
  actionUsedBy,
  addRoleplayVariant,
  adjustHitDice,
  adjustRunes,
  beginTurn,
  bloodCostFor,
  castSpell,
  combatEndRecovery,
  createSession,
  defaultRoleplayVariant,
  deriveTurnEconomy,
  endCombat,
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
  roleplayCategories,
  roleplayVariantId,
  roleplayVariants,
  SessionError,
  setScreenMode,
  setSpellNote,
  setSunlight,
  shortRest,
  spendRuneOnWardingSigil,
  spendSpellSlot,
  takeDamage,
  toggleMaterial,
  togglePreparation,
  toggleRoleplayDisabled,
  toggleRoleplayFavorite,
  undoLast,
  useArcaneRecovery,
  useRoleplayVariant,
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

describe("руна жизни начисляет временные хиты (FR-152)", () => {
  function withRune(rune: "life" | "war" | "wind", slotLevel: number, from = session): Session {
    return castSpell(
      from,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel }, rune },
      clock,
    );
  }

  it("даёт Торну 5 временных хитов за уровень ячейки", () => {
    expect(withRune("life", 1).character.temporaryHitPoints).toBe(5);
    expect(withRune("life", 3).character.temporaryHitPoints).toBe(15);
  });

  it("начисление идёт той же записью журнала, что и сотворение (FR-023)", () => {
    const after = withRune("life", 2);
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.summaryRu).toBe(
      "Доспехи мага — ячейкой 2 уровня · руна жизни: 10 временных хитов",
    );
  });

  it("не складываются с имеющимися: меньшее не берётся (FR-206)", () => {
    const stocked: Session = { ...session, character: { ...session.character, temporaryHitPoints: 12 } };
    expect(withRune("life", 1, stocked).character.temporaryHitPoints).toBe(12);
    // Руна всё равно потрачена: союзникам её хиты достались, даже если Торну нечего добавить.
    expect(withRune("life", 1, stocked).character.runes.remaining).toBe(2);
  });

  it("руны войны и ветра состояния Торна не меняют: их эффект у союзников", () => {
    expect(withRune("war", 4).character.temporaryHitPoints).toBe(0);
    expect(withRune("wind", 4).character.temporaryHitPoints).toBe(0);
  });

  it("начисление обратимо вместе с сотворением (FR-111)", () => {
    const undone = undoLast(withRune("life", 4));
    expect(undone.character.temporaryHitPoints).toBe(0);
    expect(undone.character.runes.remaining).toBe(3);
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

  it("долгий отдых возвращает здоровье (FR-130)", () => {
    const wounded = takeDamage(session, 41, clock);
    expect(longRest(wounded, clock).character.hitPoints).toEqual({
      current: 60,
      maximum: 60,
      maximumReduction: 0,
    });
  });

  it("долгий отдых возвращает восемь часов снижённого максимума (FR-130, FR-173)", () => {
    // 30 хитов на очки: максимум 30, вернуть предстоит 30. За восемь часов по 3 — 24 очка,
    // остаётся 6, и текущие поднимаются ровно до нового максимума.
    const spent = exchangeBlood(session, 30, clock);
    expect(spent.character.hitPoints).toEqual({ current: 30, maximum: 30, maximumReduction: 30 });

    expect(longRest(spent, clock).character.hitPoints).toEqual({
      current: 54,
      maximum: 54,
      maximumReduction: 6,
    });
  });

  it("отдых не обнуляет снижение махом: правило возвращает по часам", () => {
    const spent = exchangeBlood(session, 30, clock);
    expect(longRest(spent, clock).character.hitPoints.maximumReduction).toBeGreaterThan(0);
  });

  it("небольшое снижение отдых закрывает целиком", () => {
    const spent = exchangeBlood(session, 9, clock);
    expect(longRest(spent, clock).character.hitPoints).toEqual({
      current: 60,
      maximum: 60,
      maximumReduction: 0,
    });
  });

  it("возврат здоровья отменяется вместе с отдыхом (FR-111)", () => {
    const spent = exchangeBlood(takeDamage(session, 10, clock), 9, clock);
    const undone = undoLast(longRest(spent, clock));
    expect(undone.character.hitPoints).toEqual(spent.character.hitPoints);
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
    // Состояние берётся у настоящей операции: обмен уменьшает сам максимум, а `maximumReduction`
    // хранит только то, сколько предстоит вернуть по часу. Придуманная пара «максимум 60, снижение
    // 9» в жизни не встречается, и тест на ней подтверждал бы вычитание снижения дважды.
    const reduced = exchangeBlood(hurt(40), 9, clock);
    expect(reduced.character.hitPoints).toEqual({ current: 31, maximum: 51, maximumReduction: 9 });

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

describe("предпочтения отыгрыша (FR-053)", () => {
  /**
   * Карточка с тремя вариантами в одной категории. В контенте их по одному на категорию
   * (FR-050 требует минимум три на заклинание), а порядок показа виден только на нескольких.
   */
  const card: Spell = (() => {
    const base = spell("shield");
    return {
      ...base,
      roleplay: {
        ...base.roleplay,
        completeVariants: {
          short: ["Первый.", "Второй.", "Третий."],
          atmospheric: ["Атмосферный."],
          sarcastic: ["Саркастичный."],
        },
      },
    };
  })();

  const short0 = roleplayVariantId("short", 0);
  const short1 = roleplayVariantId("short", 1);
  const short2 = roleplayVariantId("short", 2);

  function texts(current: Session, category: RoleplayCategory = "short"): string[] {
    return roleplayVariants(current.character, card, category).map((variant) => variant.text);
  }

  function disableAll(current: Session, category: RoleplayCategory): Session {
    let next = current;
    for (const [index] of card.roleplay.completeVariants[category].entries()) {
      next = toggleRoleplayDisabled(next, card, roleplayVariantId(category, index));
    }
    return next;
  }

  it("без пометок показывает варианты в порядке карточки", () => {
    expect(texts(session)).toEqual(["Первый.", "Второй.", "Третий."]);
    expect(session.character.roleplayPreferences).toEqual({});
  });

  it("свой вариант показывается первым в своей категории", () => {
    const own = addRoleplayVariant(session, card.id, "short", "Не сегодня.", clock);
    expect(texts(own)).toEqual(["Не сегодня.", "Первый.", "Второй.", "Третий."]);
    // Категории не смешиваются: свой вариант живёт только в той, куда написан.
    expect(texts(own, "atmospheric")).toEqual(["Атмосферный."]);
  });

  it("пустой свой вариант отклоняется, а не сохраняется пробелами", () => {
    expect(() => addRoleplayVariant(session, card.id, "short", "   ", clock)).toThrow(SessionError);
  });

  it("любимый идёт раньше остальных, но позже своего", () => {
    let current = addRoleplayVariant(session, card.id, "short", "Не сегодня.", clock);
    current = toggleRoleplayFavorite(current, card.id, short2);
    expect(texts(current)).toEqual(["Не сегодня.", "Третий.", "Первый.", "Второй."]);
  });

  it("пометка «любимое» снимается тем же нажатием", () => {
    const once = toggleRoleplayFavorite(session, card.id, short1);
    expect(once.character.roleplayPreferences[card.id]?.favoriteVariantIds).toEqual([short1]);

    const twice = toggleRoleplayFavorite(once, card.id, short1);
    // Запись без единой пометки не хранится: в выгрузке ей взяться неоткуда.
    expect(twice.character.roleplayPreferences).toEqual({});
  });

  it("отключённый вариант уходит в конец, но категория остаётся видимой", () => {
    const after = toggleRoleplayDisabled(session, card, short0);
    const variants = roleplayVariants(after.character, card, "short");

    expect(variants.at(-1)?.id).toBe(short0);
    expect(variants.at(-1)?.disabled).toBe(true);
    expect(roleplayCategories(after.character, card)).toContain("short");
  });

  it("категория без включённых вариантов скрывается", () => {
    const current = disableAll(session, "short");
    expect(roleplayCategories(current.character, card)).toEqual(["atmospheric", "sarcastic"]);
  });

  it("последнюю категорию отключить нельзя: шаг потерял бы смысл", () => {
    let current = disableAll(session, "short");
    current = disableAll(current, "atmospheric");
    expect(roleplayCategories(current.character, card)).toEqual(["sarcastic"]);

    expect(() => toggleRoleplayDisabled(current, card, roleplayVariantId("sarcastic", 0))).toThrow(
      /Последний вариант отыгрыша/,
    );
  });

  it("отключение снимается тем же нажатием", () => {
    const off = toggleRoleplayDisabled(session, card, short0);
    const on = toggleRoleplayDisabled(off, card, short0);
    expect(roleplayVariants(on.character, card, "short")[0]?.disabled).toBe(false);
  });

  it("ротация показывает реже использованный вариант", () => {
    expect(defaultRoleplayVariant(session.character, card, "short")?.id).toBe(short0);

    const used = useRoleplayVariant(session, card.id, short0);
    expect(used.character.roleplayPreferences[card.id]?.usageCount[short0]).toBe(1);
    expect(defaultRoleplayVariant(used.character, card, "short")?.id).toBe(short1);

    // Порядок показа от счётчика не зависит: список не пересобирается под пальцем.
    expect(texts(used)).toEqual(["Первый.", "Второй.", "Третий."]);
  });

  it("счётчик копится, и ротация возвращается к первому варианту", () => {
    let current = session;
    for (const variantId of [short0, short1, short2]) {
      current = useRoleplayVariant(current, card.id, variantId);
    }
    expect(defaultRoleplayVariant(current.character, card, "short")?.id).toBe(short0);
  });

  it("ротация обходит отключённые варианты", () => {
    const off = toggleRoleplayDisabled(session, card, short0);
    expect(defaultRoleplayVariant(off.character, card, "short")?.id).toBe(short1);
  });

  it("у скрытой категории показывать нечего", () => {
    const current = disableAll(session, "short");
    expect(defaultRoleplayVariant(current.character, card, "short")).toBeUndefined();
  });

  it("предпочтения журнала не касаются и проходят схему состояния", () => {
    let current = addRoleplayVariant(session, card.id, "sarcastic", "Опять?", clock);
    current = toggleRoleplayFavorite(current, card.id, short0);
    current = useRoleplayVariant(current, card.id, short0);

    expect(current.journal).toHaveLength(0);
    expect(characterStateSchema.safeParse(current.character).success).toBe(true);
  });

  it("предпочтения одного заклинания не задевают другое", () => {
    const after = toggleRoleplayFavorite(session, card.id, short0);
    expect(roleplayVariants(after.character, spell("mage-armor"), "short")[0]?.favorite).toBe(false);
  });
});

describe("художественный текст не влияет на механику (FR-054)", () => {
  it("подмена отыгрыша не меняет результат применения", () => {
    const original = spell("mage-armor");
    const rewritten: Spell = {
      ...original,
      roleplay: {
        incantation: "Совсем другие слова.",
        gesture: "Совсем другой жест.",
        visualEffect: "Совсем другое свечение.",
        completeVariants: {
          short: ["Иначе."],
          atmospheric: ["Иначе, но длиннее."],
          sarcastic: ["Иначе, но с усмешкой."],
        },
      },
    };
    const request = { mode: "normal", payment: { kind: "slot", slotLevel: 2 } } as const;

    // Двое одинаковых часов вместо одних общих: идентификаторы и время у обоих применений
    // совпадают, и сравнение идёт по существу, а не по счётчику.
    const first = castSpell(session, { spell: original, ...request }, testClock());
    const second = castSpell(session, { spell: rewritten, ...request }, testClock());

    expect(second.character).toEqual(first.character);
    expect(second.journal).toEqual(first.journal);
  });
});


describe("подготовка заклинаний (FR-100, FR-101, FR-214)", () => {
  const LIMIT = 11;

  /**
   * Стартовый набор Торна — ровно 11 из 11, то есть предел. Тесты добавления начинают с одним
   * свободным местом: иначе они проверяли бы лимит, а не подготовку.
   */
  function withRoom(): Session {
    return {
      ...session,
      character: {
        ...session.character,
        preparedSpellIds: session.character.preparedSpellIds.slice(0, LIMIT - 1),
      },
    };
  }

  it("готовит и снимает подготовку, записывая каждое действие в журнал", () => {
    const prepared = togglePreparation(withRoom(), spell("detect-magic"), LIMIT, clock);
    expect(prepared.character.preparedSpellIds).toContain("detect-magic");
    expect(prepared.journal.at(-1)?.summaryRu).toBe("Подготовлено: Обнаружение магии");

    const dropped = togglePreparation(prepared, spell("detect-magic"), LIMIT, clock);
    expect(dropped.character.preparedSpellIds).not.toContain("detect-magic");
    expect(dropped.journal.at(-1)?.summaryRu).toBe("Снята подготовка: Обнаружение магии");
  });

  it("подготовка обратима (FR-111)", () => {
    const before = withRoom();
    const prepared = togglePreparation(before, spell("detect-magic"), LIMIT, clock);
    expect(undoLast(prepared).character.preparedSpellIds).toEqual(
      before.character.preparedSpellIds,
    );
  });

  it("лимит — жёсткое ограничение, а не предупреждение (FR-101)", () => {
    // Единственное место, где приложение отказывает без «всё равно»: это правило подготовки, и
    // мастер здесь исключений не делает (F-09).
    const full: Session = {
      ...session,
      character: {
        ...session.character,
        preparedSpellIds: session.character.spellbookSpellIds.slice(0, 3),
      },
    };
    expect(() => togglePreparation(full, spell("identify"), 3, clock)).toThrow(
      /Подготовлено 3 из 3/,
    );
  });

  it("снять подготовку на пределе можно: иначе набор было бы не пересобрать", () => {
    const full: Session = {
      ...session,
      character: {
        ...session.character,
        preparedSpellIds: session.character.spellbookSpellIds.slice(0, 3),
      },
    };
    const first = full.character.preparedSpellIds[0]!;
    const after = togglePreparation(full, spell(first), 3, clock);
    expect(after.character.preparedSpellIds).toHaveLength(2);
  });

  it("набор Торна начинается ровно на пределе: 11 из 11 (FR-101)", () => {
    expect(session.character.preparedSpellIds).toHaveLength(LIMIT);
    expect(() => togglePreparation(session, spell("blink"), LIMIT, clock)).toThrow(
      /Подготовлено 11 из 11/,
    );
  });

  it("заговор не готовится: он вне лимита и доступен всегда (FR-102)", () => {
    expect(() => togglePreparation(session, spell("ray-of-frost"), LIMIT, clock)).toThrow(
      /Заговор не готовится/,
    );
  });

  it("заклинания вне книги подготовить нельзя (FR-100)", () => {
    const foreign: Spell = { ...spell("mage-armor"), id: "fireball", nameRu: "Огненный шар" };
    expect(() => togglePreparation(session, foreign, LIMIT, clock)).toThrow(/нет в книге/);
  });

  it("ритуал готовится как обычное заклинание (FR-103)", () => {
    // FR-103 говорит, что ритуалом его можно творить и без подготовки, а не что готовить нельзя:
    // подготовленный ритуал в бою творится за ячейку обычным временем (FR-208).
    const after = togglePreparation(withRoom(), spell("identify"), LIMIT, clock);
    expect(after.character.preparedSpellIds).toContain("identify");
  });
});

describe("дорогие компоненты (FR-030)", () => {
  it("отмечается купленным и обратно израсходованным", () => {
    const bought = toggleMaterial(session, "identify", clock);
    expect(bought.character.equipment?.materialsForSpellIds).toEqual(["identify"]);
    expect(bought.journal.at(-1)?.summaryRu).toBe("Компонент куплен: identify");

    const spent = toggleMaterial(bought, "identify", clock);
    expect(spent.character.equipment?.materialsForSpellIds).toEqual([]);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Компонент израсходован: identify");
  });

  it("обратимо, как любой расход (FR-111)", () => {
    const bought = toggleMaterial(session, "identify", clock);
    expect(undoLast(bought).character.equipment?.materialsForSpellIds).toEqual([]);
  });

  it("состоянию без снаряжения отвечает причиной", () => {
    const { equipment: _none, ...unknown } = session.character;
    expect(() => toggleMaterial(createSession(unknown), "identify", clock)).toThrow(
      /не заведено снаряжение/,
    );
  });
});

describe("кости хитов (FR-134)", () => {
  it("тратятся и возвращаются по одной, обе правки в журнале", () => {
    const spent = adjustHitDice(session, -1, clock);
    expect(spent.character.hitDice?.remaining).toBe(6);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачена кость хитов: осталось 6");

    const returned = adjustHitDice(spent, 1, clock);
    expect(returned.character.hitDice?.remaining).toBe(7);
    expect(returned.journal.at(-1)?.summaryRu).toBe("Возвращена кость хитов: 7");
  });

  it("трата кости отменяется (FR-111)", () => {
    const spent = adjustHitDice(session, -1, clock);
    expect(undoLast(spent).character.hitDice?.remaining).toBe(7);
  });

  it("за пределы пула не выходит ни вверх, ни вниз", () => {
    expect(() => adjustHitDice(session, 1, clock)).toThrow(/от 0 до 7/);
    const empty = Array.from({ length: 7 }).reduce<Session>(
      (current) => adjustHitDice(current, -1, clock),
      session,
    );
    expect(empty.character.hitDice?.remaining).toBe(0);
    expect(() => adjustHitDice(empty, -1, clock)).toThrow(/от 0 до 7/);
  });

  it("состоянию без костей отвечает причиной, а не падением на undefined", () => {
    const { hitDice: _none, ...withoutDice } = session.character;
    expect(() => adjustHitDice(createSession(withoutDice), -1, clock)).toThrow(
      /не заведены кости хитов/,
    );
  });

  it("долгий отдых возвращает половину костей, округляя вниз (FR-134)", () => {
    const spent = Array.from({ length: 5 }).reduce<Session>(
      (current) => adjustHitDice(current, -1, clock),
      session,
    );
    expect(spent.character.hitDice?.remaining).toBe(2);
    // Половина от семи — три: 2 + 3 = 5, а не все семь. Долгий бой обязан стоить.
    expect(longRest(spent, clock).character.hitDice?.remaining).toBe(5);
  });

  it("возврат не переливается через край", () => {
    expect(longRest(session, clock).character.hitDice?.remaining).toBe(7);
  });

  it("персонажу без костей отдых их не выдумывает", () => {
    const { hitDice: _none, ...withoutDice } = session.character;
    expect(longRest(createSession(withoutDice), clock).character.hitDice).toBeUndefined();
  });
});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("возвращает и тратит руну, записывая обе правки", () => {
    const spent = adjustRunes(session, -1, clock);
    expect(spent.character.runes.remaining).toBe(2);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачена руна: 2");

    const returned = adjustRunes(spent, 1, clock);
    expect(returned.character.runes.remaining).toBe(3);
    expect(returned.journal.at(-1)?.summaryRu).toBe("Возвращена руна: 3");
  });

  it("за границы пула не выпускает", () => {
    expect(() => adjustRunes(session, 1, clock)).toThrow(/от 0 до 3/);
    const empty = adjustRunes(adjustRunes(adjustRunes(session, -1, clock), -1, clock), -1, clock);
    expect(() => adjustRunes(empty, -1, clock)).toThrow(/от 0 до 3/);
  });

  it("ручное списание ячейки пишется в журнал и обратимо (FR-111)", () => {
    const spent = spendSpellSlot(session, 1, clock);
    expect(spent.character.spellSlots[1]?.remaining).toBe(3);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Списана ячейка 1 уровня");
    expect(undoLast(spent).character.spellSlots[1]?.remaining).toBe(4);
  });

  it("правка руны обратима", () => {
    expect(undoLast(adjustRunes(session, -1, clock)).character.runes.remaining).toBe(3);
  });
});

describe("конец боя (FR-216)", () => {
  function wounded(current: number): Session {
    return {
      ...session,
      character: { ...session.character, hitPoints: { current, maximum: 60, maximumReduction: 0 } },
    };
  }

  it("поднимает здоровье до половины максимума", () => {
    const after = endCombat(wounded(12), clock);
    expect(after.character.hitPoints.current).toBe(30);
    expect(after.journal.at(-1)?.summaryRu).toBe("Бой закончен: восстановлено 18 до половины максимума");
  });

  it("выше половины не поднимает: до полного здоровья регенерация не доводит", () => {
    expect(endCombat(wounded(29), clock).character.hitPoints.current).toBe(30);
  });

  it("закончить бой можно и здоровым: конец боя — факт, а не лечение", () => {
    const after = endCombat(wounded(30), clock);
    expect(after.character.hitPoints.current).toBe(30);
    expect(after.journal.at(-1)?.summaryRu).toBe("Бой закончен");
    expect(after.journal.at(-1)?.kind).toBe("combat_ended");
  });

  it("считает половину от снижённого максимума, а не от исходного (FR-172)", () => {
    // Обмен уменьшил максимум до 51 — половина от него 25, а не 30.
    const spent = exchangeBlood(wounded(20), 9, clock);
    expect(combatEndRecovery(spent.character)).toBe(14);
    expect(endCombat(spent, clock).character.hitPoints.current).toBe(25);
  });

  it("восстановление обратимо (FR-111)", () => {
    expect(undoLast(endCombat(wounded(12), clock)).character.hitPoints.current).toBe(12);
  });

  it("сбрасывает счёт раундов: следующий бой начинается с первого", () => {
    let current = withTurnTracking(session);
    for (let round = 0; round < 5; round += 1) current = beginTurn(current, clock);
    expect(deriveTurnEconomy(current).round).toBe(5);

    current = endCombat(current, clock);
    expect(deriveTurnEconomy(current).round).toBe(1);
    expect(deriveTurnEconomy(current).started).toBe(false);

    current = beginTurn(current, clock);
    expect(deriveTurnEconomy(current).round).toBe(1);
  });

  it("потраченное в прошлом бою нового не связывает", () => {
    let current = beginTurn(withTurnTracking(session), clock);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      clock,
    );
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);

    current = endCombat(current, clock);
    expect(deriveTurnEconomy(current)).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: true,
      reactionAvailable: true,
    });
  });

  it("отмена возвращает и счёт раундов прежнего боя (FR-111)", () => {
    let current = withTurnTracking(session);
    for (let round = 0; round < 3; round += 1) current = beginTurn(current, clock);
    const undone = undoLast(endCombat(current, clock));
    expect(deriveTurnEconomy(undone).round).toBe(3);
  });
});

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

  it("час не только поднимает максимум, но и лечит: регенерация идёт непрерывно", () => {
    // Раненый обменом: 20 из 51 при снижении 9. За час максимум станет 54, а регенерация успевает
    // дойти до половины нового максимума — 27, а не 25 от прежнего.
    const wounded = takeDamage(afterExchange(), 31, clock);
    expect(wounded.character.hitPoints.current).toBe(20);

    const recovered = recoverHitPointMaximum(wounded, clock);
    expect(recovered.character.hitPoints).toEqual({ current: 27, maximum: 54, maximumReduction: 6 });
    expect(recovered.journal.at(-1)?.summaryRu).toBe("Прошёл час: максимум +3, регенерация +7");
  });
})

describe("короткий отдых — это час (FR-132, FR-173)", () => {
  it("возвращает ступень максимума и доводит здоровье до половины", () => {
    const wounded = takeDamage(exchangeBlood(session, 9, clock), 31, clock);
    expect(wounded.character.hitPoints).toEqual({ current: 20, maximum: 51, maximumReduction: 9 });

    const rested = shortRest(wounded, clock);
    expect(rested.character.hitPoints).toEqual({ current: 27, maximum: 54, maximumReduction: 6 });
    expect(rested.journal.at(-1)?.summaryRu).toBe("Короткий отдых · максимум +3, регенерация +7");
  });

  it("здоровому и не занимавшему в долг отдых пишется коротко", () => {
    expect(shortRest(session, clock).journal.at(-1)?.summaryRu).toBe("Короткий отдых");
  });

  it("под подавлением час проходит впустую: особенности не действуют (FR-176)", () => {
    const burned = takeDamage(exchangeBlood(session, 9, clock), 31, clock, { fire: true });
    const rested = shortRest(burned, clock);

    expect(rested.character.hitPoints).toEqual({ current: 20, maximum: 51, maximumReduction: 9 });
    expect(rested.journal.at(-1)?.summaryRu).toBe("Короткий отдых");
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
