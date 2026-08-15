import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import { saveStatId } from "@/core/domain/shared/stats";
import { setSpellNote, toggleMaterial, togglePreparation } from "@/core/application/useCases/library";
import {
  arcaneRecoveryUnavailability,
  longRest,
  shortRest,
  shortRestUnavailability,
  useArcaneRecovery,
} from "@/core/application/useCases/rest";
import {
  endConcentration,
  endEffect,
  setArmorClassAdjustment,
  spendRuneOnWardingSigil,
  startManualEffect,
  wardingSigilAvailable,
} from "@/core/application/useCases/effects";
import { exchangeBlood, grantTemporaryHitPoints, heal, recoverHitPointMaximum, setSunlight, takeDamage } from "@/core/application/useCases/health";
import { beginTurn, combatEndRecovery, deriveTurnEconomy, endCombat, startCombat } from "@/core/application/useCases/turn";
import { adjustRunes, refundSpellSlot, spendSpellSlot } from "@/core/application/useCases/resources";
import { addRoleplayVariant, defaultRoleplayVariant, roleplayCategories, roleplayVariants, toggleRoleplayDisabled, toggleRoleplayFavorite, useRoleplayVariant } from "@/core/application/useCases/roleplay";
import { castSpell } from "@/core/application/useCases/casting";
import { DomainError } from "@/core/domain/shared/errors";
import { beforeEach, describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { characterStateSchema } from "@/core/domain/assembly/state";
import { Vitality } from "@/core/domain/vitality/vitality";
import type { Spell } from "@/core/domain/catalog/spell";
import type { RoleplayCategory } from "@/core/domain/catalog/roleplay";
import { createSession, undoLast, type Session } from "@/core/application/session";
import { fromPersisted, parsePersisted, toPersisted } from "@/core/application/ports/sessionRepository";
import {
  withBloodExchange,
  withDamage,
  withMasterReduction,
  withSpellPoints,
  withSpentHitDice,
} from "@/core/infrastructure/catalog/thorne/fixtures";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/** Детерминированные часы: чистые функции время не изобретают. */
function testOccasion(commandId = "command-1") {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
    commandId,
  };
}

let occasion: ReturnType<typeof testOccasion>;
let session: Session;

beforeEach(() => {
  occasion = testOccasion();
  session = createSession(createThorne());
});

/**
 * Бой отмечен начатым: только тогда ведётся учёт хода. Отметка — та же операция, которой её ставит
 * игрок, и она же считается первым ходом.
 */
function withTurnTracking(base: Session): Session {
  return startCombat(base, occasion);
}

/**
 * Вне боя: ходов нет, значит и расходовать в них нечего. Отметки не ставится вовсе — помощник
 * оставлен именем, он объясняет, почему тест ничего не включает.
 */
function outOfCombat(base: Session): Session {
  return base;
}

describe("начальное состояние Торна", () => {
  it("проходит схему и содержит подтверждённые числа", () => {
    const thorne = createThorne();
    expect(characterStateSchema.safeParse(thorne).success).toBe(true);
    const totals = Character.of(thorne).sheet;
    expect(totals.value("spellSaveDc")).toBe(16);
    expect(totals.value("spellAttackModifier")).toBe(8);
    expect(totals.value(saveStatId("constitution"))).toBe(4);
    expect(thorne.hitPoints).toEqual({ current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 });
    expect(thorne.runes).toEqual({ maximum: 3, remaining: 3 });
    expect(thorne.spellSlots[1]?.maximum).toBe(4);
    expect(thorne.spellSlots[4]?.maximum).toBe(1);
  });

  it("каждый вызов даёт независимый объект", () => {
    const first = withDamage(createThorne(), 59);
    expect(first.hitPoints.current).toBe(1);
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
      occasion,
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
      occasion,
    );
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.kind).toBe("reaction_cast");
  });

  it("заговор не расходует ячейку (FR-072)", () => {
    const after = castSpell(
      session,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" }, targetLabel: "гоблин" },
      occasion,
    );
    expect(after.character.spellSlots).toEqual(session.character.spellSlots);
    expect(after.journal[0]?.summaryRu).toBe("Луч холода — заговором");
  });

  it("ритуал не расходует ячейку (FR-073)", () => {
    const after = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "ritual", payment: { kind: "none" } },
      occasion,
    );
    expect(after.character.spellSlots).toEqual(session.character.spellSlots);
    expect(after.journal[0]?.summaryRu).toBe("Обнаружение магии — ритуалом");
  });

  it("отклоняет оплату ячейкой для заговора и ритуала", () => {
    expect(() =>
      castSpell(
        session,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "slot", slotLevel: 1 } },
        occasion,
      ),
    ).toThrow(/Заговор не расходует ячейку/);
    expect(() =>
      castSpell(
        session,
        { spell: spell("identify"), mode: "ritual", payment: { kind: "slot", slotLevel: 1 } },
        occasion,
      ),
    ).toThrow(/Ритуальное применение не расходует ячейку/);
  });

  it("отклоняет ячейку ниже уровня заклинания", () => {
    const highLevel: Spell = { ...spell("shield"), level: 3 };
    expect(() =>
      castSpell(session, { spell: highLevel, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, occasion),
    ).toThrow(/ниже уровня заклинания/);
  });

  it("требует способа оплаты для заклинания с ячейкой", () => {
    expect(() =>
      castSpell(session, { spell: spell("shield"), mode: "normal", payment: { kind: "none" } }, occasion),
    ).toThrow(/требует способа оплаты/);
  });

  it("мгновенное заклинание эффекта не создаёт", () => {
    const instant: Spell = { ...spell("shield"), duration: { type: "instant" } };
    const after = castSpell(
      session,
      { spell: instant, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(after.character.activeEffects).toHaveLength(0);
  });

  it("«Применить всё равно» пускает ячейку в минус (FR-031)", () => {
    let current = session;
    current = castSpell(
      current,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
      occasion,
    );
    expect(current.character.spellSlots[4]?.remaining).toBe(0);
    expect(() =>
      castSpell(
        current,
        { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
        occasion,
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
      occasion,
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
      occasion,
    );
    expect(deriveTurnEconomy(current).actionAvailable).toBe(false);

    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);

    const bonus: Spell = { ...spell("disguise-self"), castingTime: { type: "bonus_action" } };
    current = castSpell(
      current,
      { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(deriveTurnEconomy(current).bonusActionAvailable).toBe(false);
  });

  it.each([
    ["действие", "mage-armor", /Действие уже израсходовано/],
    ["реакцию", "shield", /Реакция уже израсходована/],
  ])("не даёт потратить %s дважды", (_what, id, expected) => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell(id), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(() =>
      castSpell(
        current,
        { spell: spell(id), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
        occasion,
      ),
    ).toThrow(expected);
  });

  it("не даёт потратить бонусное действие дважды", () => {
    const bonus: Spell = { ...spell("disguise-self"), castingTime: { type: "bonus_action" } };
    let current = withTurnTracking(session);
    current = castSpell(current, { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, occasion);
    expect(() =>
      castSpell(current, { spell: bonus, mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, occasion),
    ).toThrow(/Бонусное действие уже израсходовано/);
  });

  it("вне боя действие не расходуется (FR-143)", () => {
    let current = outOfCombat(session);
    for (let index = 0; index < 3; index += 1) {
      current = castSpell(
        current,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
        occasion,
      );
    }
    expect(deriveTurnEconomy(current).actionAvailable).toBe(true);
  });

  it("время «минута» и «час» действие не расходуют", () => {
    const current = castSpell(
      withTurnTracking(session),
      { spell: spell("find-familiar"), mode: "ritual", payment: { kind: "none" } },
      occasion,
    );
    expect(deriveTurnEconomy(current).actionAvailable).toBe(true);
  });

  it("начало хода восстанавливает действие и реакцию (FR-140)", () => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    current = beginTurn(current, occasion);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
    expect(deriveTurnEconomy(current).actionAvailable).toBe(true);
  });
});

describe("истечение эффекта в раундах (FR-094)", () => {
  const castShield = (base: Session): Session =>
    castSpell(
      base,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );

  it("начало хода снимает истёкшее: «Щит» держится один раунд", () => {
    const shielded = castShield(withTurnTracking(session));
    expect(shielded.character.activeEffects).toHaveLength(1);

    const next = beginTurn(shielded, occasion);
    expect(next.character.activeEffects).toEqual([]);
    expect(next.journal.at(-1)?.summaryRu).toContain("«Щит» истёк");
  });

  it("снятие обратимо: ошибка возвращается отменой (FR-111)", () => {
    const next = beginTurn(castShield(withTurnTracking(session)), occasion);
    expect(undoLast(next).character.activeEffects).toHaveLength(1);
  });

  it("эффект в минутах начало хода не трогает: часов приложение не считает", () => {
    // «Обнаружение магии» — 10 минут: сколько времени прошло между ходами, приложение не знает.
    const casting = castSpell(
      withTurnTracking(session),
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(beginTurn(casting, occasion).character.activeEffects).toHaveLength(1);
  });

  it("эффект на несколько раундов переживает свой первый ход", () => {
    const shield = spell("shield");
    const threeRounds: Spell = { ...shield, duration: { type: "rounds", value: 3 } };
    let current = castSpell(
      withTurnTracking(session),
      { spell: threeRounds, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );

    current = beginTurn(current, occasion);
    expect(current.character.activeEffects).toHaveLength(1);
    current = beginTurn(current, occasion);
    expect(current.character.activeEffects).toHaveLength(1);
    current = beginTurn(current, occasion);
    expect(current.character.activeEffects).toEqual([]);
  });

  it("истёкшая концентрация заканчивается вместе с эффектом (FR-083)", () => {
    // Концентрация и эффект разойтись не могут: схема состояния такого и не пропустит.
    const detectMagic = spell("detect-magic");
    const brief: Spell = { ...detectMagic, duration: { type: "rounds", value: 1 } };
    const casting = castSpell(
      withTurnTracking(session),
      { spell: brief, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(casting.character.concentration).toBeDefined();

    const next = beginTurn(casting, occasion);
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
      occasion,
    );
    expect(after.character.concentration?.spellId).toBe("detect-magic");
    expect(after.character.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(1);
  });

  it("вторая концентрация без подтверждения отклоняется", () => {
    const first = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(() =>
      castSpell(
        first,
        { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
        occasion,
      ),
    ).toThrow(/Уже идёт концентрация/);
  });

  it("исключение мастера замену концентрации не разрешает: согласие своё (FR-031)", () => {
    const first = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(() =>
      castSpell(
        first,
        {
          spell: { ...concentrating(), id: "other-concentration", nameRu: "Другое" },
          mode: "normal",
          payment: { kind: "slot", slotLevel: 1 },
          allowAnyway: true,
        },
        occasion,
      ),
    ).toThrow(/Уже идёт концентрация/);
  });

  it("подтверждённая замена оставляет ровно одну концентрацию (UC-03)", () => {
    const first = castSpell(
      session,
      { spell: concentrating(), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const replaced = castSpell(
      first,
      {
        spell: { ...concentrating(), id: "other-concentration", nameRu: "Другое" },
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
        replaceConcentration: true,
      },
      occasion,
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
        occasion,
      );
      const ended = endConcentration(started, reason, occasion);
      expect(ended.character.concentration).toBeUndefined();
      expect(ended.character.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(0);
      expect(ended.journal.at(-1)?.kind).toBe("concentration_ended");
    },
  );

  it("завершать нечего, если концентрации нет", () => {
    expect(() => endConcentration(session, "manual", occasion)).toThrow(DomainError);
  });
});

describe("«Знаки ограждения» (FR-153, FR-154)", () => {
  it("доступны при наличии руны и реакции", () => {
    expect(wardingSigilAvailable(session)).toBe(true);
  });

  it("тратят руну и реакцию", () => {
    const after = spendRuneOnWardingSigil(withTurnTracking(session), occasion);
    expect(after.character.runes.remaining).toBe(2);
    expect(deriveTurnEconomy(after).reactionAvailable).toBe(false);
    expect(after.journal.at(-1)?.kind).toBe("rune_spent");
  });

  it("недоступны без реакции", () => {
    const base = withTurnTracking(session);
    const spent = spendRuneOnWardingSigil(base, occasion);
    expect(wardingSigilAvailable(spent)).toBe(false);
    expect(() => spendRuneOnWardingSigil(spent, occasion)).toThrow(/Реакция уже израсходована/);
  });

  it("недоступны без рун", () => {
    const drained: Session = {
      ...session,
      character: { ...session.character, runes: { maximum: 3, remaining: 0 } },
    };
    expect(wardingSigilAvailable(drained)).toBe(false);
    expect(() => spendRuneOnWardingSigil(drained, occasion)).toThrow(/Рун не осталось/);
  });

  it("спасают концентрацию: провал проверки можно не доводить до конца", () => {
    const started = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const saved = spendRuneOnWardingSigil(started, occasion);
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
      occasion,
    );
    expect(after.character.runes.remaining).toBe(2);
  });

  it("не применяется к оплате кровью", () => {
    const withPoints: Session = {
      ...session,
      character: withSpellPoints(session.character, 5),
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
        occasion,
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
        occasion,
      ),
    ).toThrow(/Рун не осталось/);
  });
});

describe("руна жизни начисляет временные хиты (FR-152)", () => {
  function withRune(rune: "life" | "war" | "wind", slotLevel: number, from = session): Session {
    return castSpell(
      from,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel }, rune },
      occasion,
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
    // Руна всё равно потрачена: хиты она дала, даже если Торну нечего добавить.
    expect(withRune("life", 1, stocked).character.runes.remaining).toBe(2);
  });

  it("выбранный другой хиты Торну не даёт, а руну всё равно тратит (FR-156)", () => {
    const cast = castSpell(
      session,
      {
        spell: spell("mage-armor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 3 },
        rune: "life",
        runeTarget: "other",
      },
      occasion,
    );

    expect(cast.character.temporaryHitPoints).toBe(0);
    expect(cast.character.runes.remaining).toBe(2);
    expect(cast.journal.at(-1)?.summaryRu).toContain("15 временных хитов другому");
  });

  it("руны войны и ветра состояния Торна не меняют: чужих бросков приложение не ведёт", () => {
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
  it("обменивает хиты на очки и снижает максимум", () => {
    const after = exchangeBlood(session, 3, occasion);
    expect(after.character.spellPoints.remaining).toBe(3);
    expect(after.character.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 9,
      masterReduction: 0,
    });
    expect(after.journal.at(-1)?.kind).toBe("blood_exchange");
  });

  it("каждое очко всегда кратно курсу: ровно 9 хитов за 3 очка", () => {
    const after = exchangeBlood(session, 3, occasion);
    expect(after.character.spellPoints.remaining).toBe(3);
    expect(after.character.hitPoints.current).toBe(51);
  });

  it("отклоняет нулевой обмен", () => {
    expect(() => exchangeBlood(session, 0, occasion)).toThrow(/Нужно хотя бы одно очко/);
  });

  it("отклоняет обмен дороже текущего здоровья", () => {
    const weak: Session = {
      ...session,
      character: withDamage(session.character, 55),
    };
    expect(() => exchangeBlood(weak, 3, occasion)).toThrow(/в наличии 5/);
  });

  it("расходует действие при включённом учёте хода", () => {
    const after = exchangeBlood(withTurnTracking(session), 3, occasion);
    expect(deriveTurnEconomy(after).actionAvailable).toBe(false);
  });

  it("оплачивает заклинание очками", () => {
    const withPoints = exchangeBlood(session, 2, occasion);
    const cast = castSpell(
      withPoints,
      { spell: spell("shield"), mode: "normal", payment: { kind: "spell_points" } },
      occasion,
    );
    expect(cast.character.spellPoints.remaining).toBe(0);
    expect(cast.character.spellSlots[1]?.remaining).toBe(4);
    expect(cast.journal.at(-1)?.summaryRu).toContain("кровью, 2 очков");
  });

  it("отклоняет оплату, когда очков не хватает", () => {
    expect(() =>
      castSpell(session, { spell: spell("shield"), mode: "normal", payment: { kind: "spell_points" } }, occasion),
    ).toThrow(/Очков заклинаний 0, нужно 2/);
  });

  it("подавлено уроном огнём и солнцем (FR-176)", () => {
    const burned = takeDamage(session, 7, occasion, { fire: true });
    expect(() => exchangeBlood(burned, 3, occasion)).toThrow(/подавлено уроном огнём/);

    const sunlit = setSunlight(session, true, occasion);
    expect(() => exchangeBlood(sunlit, 3, occasion)).toThrow(/под прямым солнечным светом/);
  });

  it("подавление обходится явным разрешением", () => {
    const burned = takeDamage(session, 7, occasion, { fire: true });
    expect(exchangeBlood(burned, 3, occasion, { allowAnyway: true }).character.spellPoints.remaining).toBe(3);
  });
});

describe("урон, подавление и регенерация (FR-180…FR-182)", () => {
  it("урон уменьшает хиты и не уходит ниже нуля", () => {
    expect(takeDamage(session, 70, occasion).character.hitPoints.current).toBe(0);
  });

  it("огненный урон подавляет особенности до конца следующего хода", () => {
    const burned = takeDamage(session, 5, occasion, { fire: true });
    expect(Vitality.of(burned.character).firedUpon).toBe(true);
    expect(burned.journal.at(-1)?.summaryRu).toContain("огонь");

    const nextTurn = beginTurn(burned, occasion);
    expect(Vitality.of(nextTurn.character).firedUpon).toBe(true);
    expect(Vitality.of(beginTurn(nextTurn, occasion).character).firedUpon).toBe(false);
  });

  it("регенерация возвращается ходом позже подавления огнём", () => {
    const burned = takeDamage(takeDamage(session, 40, occasion), 1, occasion, { fire: true });
    const wounded = burned.character.hitPoints.current;

    const nextTurn = beginTurn(burned, occasion);
    expect(nextTurn.character.hitPoints.current).toBe(wounded);
    expect(beginTurn(nextTurn, occasion).character.hitPoints.current).toBeGreaterThan(wounded);
  });

  it.each([0, -3, 1.5])("отклоняет урон %s", (damage) => {
    expect(() => takeDamage(session, damage, occasion)).toThrow(DomainError);
  });

  it("признак солнца переключается и не переключается впустую", () => {
    const sunlit = setSunlight(session, true, occasion);
    expect(sunlit.character.suppression.underDirectSunlight).toBe(true);
    expect(() => setSunlight(sunlit, true, occasion)).toThrow(/уже в этом состоянии/);
    expect(setSunlight(sunlit, false, occasion).character.suppression.underDirectSunlight).toBe(false);
  });

  it("регенерация действует только ниже половины максимума и без подавления", () => {
    expect(Vitality.of(session.character).regenerationDue(session.character.level)).toBe(0);
    const wounded = takeDamage(session, 40, occasion);
    expect(Vitality.of(wounded.character).regenerationDue(wounded.character.level)).toBe(3);
    const burned = takeDamage(wounded, 1, occasion, { fire: true });
    expect(Vitality.of(burned.character).regenerationDue(burned.character.level)).toBe(0);
    const downed = takeDamage(wounded, 100, occasion);
    expect(Vitality.of(downed.character).regenerationDue(downed.character.level)).toBe(0);
  });

  it("порог регенерации едет за действующим максимумом", () => {
    // Максимум стал 30, текущее 30 — половина не пройдена.
    const exchanged = exchangeBlood(session, 10, occasion);
    expect(Vitality.of(exchanged.character).regenerationDue(exchanged.character.level)).toBe(0);
    const wounded = takeDamage(exchanged, 20, occasion);
    expect(Vitality.of(wounded.character).regenerationDue(wounded.character.level)).toBe(3);

    // Снижение мастером роняет тот же максимум до 18: те же 10 хитов теперь выше половины.
    const lowered = { ...wounded, character: withMasterReduction(wounded.character, 12) };
    expect(Vitality.of(lowered.character).regenerationDue(lowered.character.level)).toBe(0);
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
      occasion,
    );
    current = exchangeBlood(current, 3, occasion);
    current = longRest(current, occasion);

    expect(current.character.spellSlots[2]?.remaining).toBe(3);
    expect(current.character.runes.remaining).toBe(3);
    expect(current.character.concentration).toBeUndefined();
    expect(current.character.spellPoints).toEqual({ remaining: 0 });
    expect(current.character.arcaneRecovery).toEqual({ maximum: 4, remaining: 4 });
  });

  it("долгий отдых возвращает здоровье (FR-130)", () => {
    const wounded = takeDamage(session, 41, occasion);
    expect(longRest(wounded, occasion).character.hitPoints).toEqual({
      current: 60,
      maximumBase: 60,
      bloodReduction: 0,
      masterReduction: 0,
    });
  });

  it("долгий отдых возвращает восемь часов снижённого максимума (FR-130, FR-173)", () => {
    // 30 хитов на очки: максимум 30, вернуть предстоит 30. За восемь часов по 3 — 24 очка,
    // остаётся 6, и текущие поднимаются ровно до нового максимума.
    const spent = exchangeBlood(session, 10, occasion);
    expect(spent.character.hitPoints).toEqual({ current: 30, maximumBase: 60, bloodReduction: 30, masterReduction: 0 });

    expect(longRest(spent, occasion).character.hitPoints).toEqual({
      current: 54,
      maximumBase: 60,
      bloodReduction: 6,
      masterReduction: 0,
    });
  });

  it("отдых не обнуляет снижение махом: правило возвращает по часам", () => {
    const spent = exchangeBlood(session, 10, occasion);
    expect(longRest(spent, occasion).character.hitPoints.bloodReduction).toBeGreaterThan(0);
  });

  it("небольшое снижение отдых закрывает целиком", () => {
    const spent = exchangeBlood(session, 3, occasion);
    expect(longRest(spent, occasion).character.hitPoints).toEqual({
      current: 60,
      maximumBase: 60,
      bloodReduction: 0,
      masterReduction: 0,
    });
  });

  it("возврат здоровья отменяется вместе с отдыхом (FR-111)", () => {
    const spent = exchangeBlood(takeDamage(session, 10, occasion), 9, occasion);
    const undone = undoLast(longRest(spent, occasion));
    expect(undone.character.hitPoints).toEqual(spent.character.hitPoints);
  });

  it("долгий отдых оставляет срок заклинания и снимает отметку, заведённую рукой", () => {
    const untimed: Spell = { ...spell("mage-armor"), duration: { type: "special" } };
    let current = castSpell(
      session,
      { spell: untimed, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    current = startManualEffect(current, { nameRu: "Отравлен" }, occasion);
    current = longRest(current, occasion);

    expect(current.character.activeEffects.map((effect) => effect.duration.type)).toEqual([
      "until_spell_ends",
    ]);
  });

  it("долгий отдых называет снятое, а отмена его возвращает", () => {
    const marked = startManualEffect(session, { nameRu: "Отравлен" }, occasion);
    const rested = longRest(marked, occasion);

    expect(rested.character.activeEffects).toEqual([]);
    expect(rested.journal.at(-1)?.summaryRu).toBe("Долгий отдых · «Отравлен» истёк");
    expect(undoLast(rested).character.activeEffects).toHaveLength(1);
  });

  it("короткий отдых ячейки не восстанавливает (FR-132)", () => {
    let current = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    current = shortRest(current, occasion);
    expect(current.character.spellSlots[1]?.remaining).toBe(3);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("два последовательных частичных восстановления укладываются в общий бюджет (FR-131)", () => {
    let current = outOfCombat(session);
    for (let i = 0; i < 4; i += 1) current = spendSpellSlot(current, 1, occasion);
    expect(current.character.spellSlots[1]?.remaining).toBe(0);
    current = shortRest(current, occasion);

    current = useArcaneRecovery(current, { 1: 1 }, occasion);
    expect(current.character.spellSlots[1]?.remaining).toBe(1);
    expect(current.character.arcaneRecovery).toEqual({ maximum: 4, remaining: 3 });

    current = useArcaneRecovery(current, { 1: 1 }, occasion);
    expect(current.character.spellSlots[1]?.remaining).toBe(2);
    expect(current.character.arcaneRecovery).toEqual({ maximum: 4, remaining: 2 });
  });

  it("третье восстановление отклоняется, когда бюджет исчерпан (FR-131)", () => {
    let current = outOfCombat(session);
    for (let i = 0; i < 4; i += 1) current = spendSpellSlot(current, 1, occasion);
    current = shortRest(current, occasion);

    current = useArcaneRecovery(current, { 1: 2 }, occasion);
    current = useArcaneRecovery(current, { 1: 2 }, occasion);
    expect(current.character.arcaneRecovery.remaining).toBe(0);

    current = spendSpellSlot(current, 1, occasion);
    expect(() => useArcaneRecovery(current, { 1: 1 }, occasion)).toThrow(
      /Дневной бюджет восстановления исчерпан/,
    );
  });

  it("исчерпанный бюджет называется той же причиной, которой гаснет кнопка (FR-131)", () => {
    let current = outOfCombat(session);
    for (let i = 0; i < 4; i += 1) current = spendSpellSlot(current, 1, occasion);
    current = shortRest(current, occasion);
    current = useArcaneRecovery(current, { 1: 2 }, occasion);
    current = useArcaneRecovery(current, { 1: 2 }, occasion);

    const reason = arcaneRecoveryUnavailability(current);
    expect(reason).toMatch(/Дневной бюджет восстановления исчерпан/);
    expect(() => useArcaneRecovery(current, { 1: 1 }, occasion)).toThrow(reason ?? "");
  });

  it("долгий отдых заполняет бюджет заново (FR-131)", () => {
    let current = outOfCombat(session);
    current = spendSpellSlot(current, 1, occasion);
    current = shortRest(current, occasion);
    current = useArcaneRecovery(current, { 1: 1 }, occasion);
    expect(current.character.arcaneRecovery.remaining).toBe(3);

    current = longRest(current, occasion);
    expect(current.character.arcaneRecovery).toEqual({ maximum: 4, remaining: 4 });
  });

  it("магическое восстановление не превышает остаток бюджета одним планом", () => {
    let current = outOfCombat(session);
    for (const level of [3, 2] as const) {
      current = castSpell(
        current,
        { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: level } },
        occasion,
      );
    }
    current = shortRest(current, occasion);
    expect(() => useArcaneRecovery(current, { 3: 1, 2: 1 }, occasion)).toThrow(
      /превышает остаток бюджета 4/,
    );
  });

  it("долгий отдых отказывает во время боя и не трогает ячейки (FR-215)", () => {
    const spent = castSpell(
      withTurnTracking(session),
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    // Худший случай: долгий отдых посреди раунда молча вернул бы все ячейки разом.
    expect(() => longRest(spent, occasion)).toThrow(/Пока идёт бой/);
    expect(spent.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("короткий отдых отказывает во время боя (FR-215)", () => {
    expect(() => shortRest(withTurnTracking(session), occasion)).toThrow(/Пока идёт бой/);
  });

  it("магическое восстановление отказывает во время боя (FR-215)", () => {
    expect(() => useArcaneRecovery(withTurnTracking(session), { 1: 1 }, occasion)).toThrow(
      /Пока идёт бой/,
    );
  });

  it("возврат ошибочной ячейки (FR-071)", () => {
    let current = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 2 } },
      occasion,
    );
    current = refundSpellSlot(current, 2, occasion);
    expect(current.character.spellSlots[2]?.remaining).toBe(3);
    expect(current.journal.at(-1)?.kind).toBe("slot_refunded");
  });
});

describe("активные эффекты (FR-091)", () => {
  it("ручное завершение убирает эффект", () => {
    const cast = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const effectId = cast.character.activeEffects[0]?.id ?? "";
    const ended = endEffect(cast, effectId, occasion);
    expect(ended.character.activeEffects).toHaveLength(0);
  });

  it("завершение концентрационного эффекта снимает и концентрацию", () => {
    const cast = castSpell(
      session,
      { spell: spell("detect-magic"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const effectId = cast.character.activeEffects[0]?.id ?? "";
    const ended = endEffect(cast, effectId, occasion);
    expect(ended.character.concentration).toBeUndefined();
  });

  it("отклоняет неизвестный эффект", () => {
    expect(() => endEffect(session, "нет-такого", occasion)).toThrow(DomainError);
  });
});

describe("ручной эффект (FR-236)", () => {
  it("создаёт эффект без заклинания и пишет это в журнал", () => {
    const after = startManualEffect(session, { nameRu: "Опутанный" }, occasion);

    expect(after.character.activeEffects).toHaveLength(1);
    const [effect] = after.character.activeEffects;
    expect(effect?.nameRu).toBe("Опутанный");
    expect(effect?.spellId).toBeUndefined();
    expect(effect?.isConcentration).toBe(false);
    expect(effect?.contributions).toEqual([]);
    expect(after.journal.at(-1)?.summaryRu).toBe("Эффект начат: Опутанный");
  });

  it("вклад в Класс Доспеха складывается с активными эффектами заклинаний", () => {
    // В бою: раундовая длительность «Щита» не истекает сразу же после сотворения.
    const shielded = castSpell(
      withTurnTracking(session),
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const after = startManualEffect(
      shielded,
      { nameRu: "Прикрытие союзника", armorClassBonus: 2 },
      occasion,
    );

    // Без вкладов: 14; «Щит» прибавляет 5; прикрытие союзника прибавляет ещё 2.
    expect(Character.of(after.character).sheet.value("armorClass")).toBe(21);
  });

  it("снимается тем же путём, что и любой активный эффект", () => {
    const started = startManualEffect(session, { nameRu: "Опутанный" }, occasion);
    const effectId = started.character.activeEffects[0]?.id ?? "";

    const ended = endEffect(started, effectId, occasion);

    expect(ended.character.activeEffects).toHaveLength(0);
    expect(ended.journal.at(-1)?.summaryRu).toBe("Эффект завершён: Опутанный");
  });

  it("отклоняет пустое имя", () => {
    expect(() => startManualEffect(session, { nameRu: "   " }, occasion)).toThrow(DomainError);
  });

  it("отклоняет неположительный вклад в Класс Доспеха", () => {
    expect(() =>
      startManualEffect(session, { nameRu: "Статус", armorClassBonus: 0 }, occasion),
    ).toThrow(DomainError);
  });

  it("отклоняет дробный вклад в Класс Доспеха", () => {
    expect(() =>
      startManualEffect(session, { nameRu: "Статус", armorClassBonus: 1.5 }, occasion),
    ).toThrow(DomainError);
  });
});

describe("поправка к КД (FR-236)", () => {
  it("заводит поправку одним эффектом и складывает её по общему правилу", () => {
    const after = setArmorClassAdjustment(session, 2, occasion);

    expect(after.character.activeEffects).toHaveLength(1);
    expect(Character.of(after.character).sheet.value("armorClass")).toBe(16);
    expect(after.journal.at(-1)?.summaryRu).toBe("Поправка к КД: +2");
  });

  it("допускает отрицательное значение", () => {
    const after = setArmorClassAdjustment(session, -3, occasion);

    expect(Character.of(after.character).sheet.value("armorClass")).toBe(11);
    expect(after.journal.at(-1)?.summaryRu).toBe("Поправка к КД: −3");
  });

  it("новое значение заменяет прежнее одним переходом, а не двумя", () => {
    const first = setArmorClassAdjustment(session, 2, occasion);
    const journalLengthAfterFirst = first.journal.length;

    const second = setArmorClassAdjustment(first, 5, occasion);

    expect(second.character.activeEffects).toHaveLength(1);
    expect(Character.of(second.character).sheet.value("armorClass")).toBe(19);
    expect(second.journal.length).toBe(journalLengthAfterFirst + 1);
  });

  it("ноль снимает поправку вовсе", () => {
    const started = setArmorClassAdjustment(session, 2, occasion);

    const cleared = setArmorClassAdjustment(started, 0, occasion);

    expect(cleared.character.activeEffects).toHaveLength(0);
    expect(Character.of(cleared.character).sheet.value("armorClass")).toBe(14);
  });

  it("ноль без заведённой поправки ничего не делает", () => {
    const after = setArmorClassAdjustment(session, 0, occasion);

    expect(after).toBe(session);
  });

  it("несёт типизированный признак: опознание не зависит от подписи", () => {
    const after = setArmorClassAdjustment(session, 2, occasion);

    expect(after.character.activeEffects[0]?.manualKind).toBe("armorAdjustment");
  });

  it("отклоняет дробное значение", () => {
    expect(() => setArmorClassAdjustment(session, 1.5, occasion)).toThrow(DomainError);
  });

  it("не путается с другими активными эффектами: складывается с «Щитом»", () => {
    // В бою: раундовая длительность «Щита» не истекает сразу же после сотворения.
    const shielded = castSpell(
      withTurnTracking(session),
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );

    const after = setArmorClassAdjustment(shielded, 2, occasion);

    // Без вкладов: 14; «Щит» прибавляет 5; поправка прибавляет ещё 2.
    expect(Character.of(after.character).sheet.value("armorClass")).toBe(21);
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
      occasion,
    );
    const undone = undoLast(after);
    expect(undone.character).toEqual(before);
    expect(undone.journal).toHaveLength(0);
  });

  it.each([
    ["применение заговора", (s: Session) => castSpell(s, { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } }, occasion)],
    ["кровавое колдовство", (s: Session) => exchangeBlood(s, 3, occasion)],
    ["урон", (s: Session) => takeDamage(s, 12, occasion, { fire: true })],
    ["солнце", (s: Session) => setSunlight(s, true, occasion)],
    ["руну на знаки ограждения", (s: Session) => spendRuneOnWardingSigil(s, occasion)],
    ["долгий отдых", (s: Session) => longRest(exchangeBlood(s, 3, occasion), occasion)],
    // Отдых обязан что-то восстанавливать, иначе случай ничего не проверяет:
    // сначала тратим реакцию и руну, потом отдыхаем.
    ["короткий отдых", (s: Session) => shortRest(spendRuneOnWardingSigil(s, occasion), occasion)],
    ["начало хода", (s: Session) => beginTurn(takeDamage(s, 5, occasion, { fire: true }), occasion)],
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
      occasion,
    );
    const beforeRest = structuredClone(current.character);
    current = longRest(current, occasion);
    current = undoLast(current);
    expect(current.character).toEqual(beforeRest);
  });

  it("пустой журнал отменять нечего", () => {
    expect(() => undoLast(session)).toThrow(/Журнал пуст/);
  });

  it("испорченный снимок отмены не становится состоянием", () => {
    const spent = spendSpellSlot(session, 1, occasion);
    const stored = toPersisted(spent, occasion.now(), null);
    // Хранилище проверяет у снимка принадлежность ключей, а не значения: такая запись доживает до
    // отмены.
    const corrupted = fromPersisted(
      parsePersisted({
        ...stored,
        journal: stored.journal.map((entry) => ({ ...entry, undoPatch: { hitPoints: "banana" } })),
      }),
    );

    expect(() => undoLast(corrupted)).toThrow(DomainError);
    expect(() => undoLast(corrupted)).toThrow(/hitPoints/);
    expect(corrupted.character.spellSlots[1]?.remaining).toBe(3);
    expect(corrupted.journal).toHaveLength(1);
  });

  it("отмена записи без снимка называет причину, а не делает вид, что вернула состояние", () => {
    const stored = toPersisted(spendSpellSlot(session, 1, occasion), occasion.now(), null);
    // Так выглядит запись прежней версии: снимок возвращал учёт хода, которого состояние уже не
    // знает, и приведение оставило запись без снимка.
    const legacy = fromPersisted(
      parsePersisted({
        ...stored,
        journal: stored.journal.map((entry) => ({
          ...entry,
          undoPatch: { turnTracking: { enabled: false } },
        })),
      }),
    );

    expect(() => undoLast(legacy)).toThrow(DomainError);
    expect(() => undoLast(legacy)).toThrow(/снимка отмены/);
    expect(legacy.journal).toHaveLength(1);
    expect(legacy.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("многократная отмена идёт по одному действию назад", () => {
    let current = outOfCombat(session);
    const snapshots = [structuredClone(current.character)];
    for (const level of [1, 2, 3] as const) {
      current = castSpell(
        current,
        { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: level } },
        occasion,
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
    // Заговор вне боя не тратит ничего, но требует записать применение.
    const before = outOfCombat(session);
    const after = castSpell(
      before,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
      occasion,
    );
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.undoPatch).toEqual({});
    expect(after.character).toEqual(before.character);
  });

  it("отмена записи без изменений убирает только строку журнала", () => {
    const after = castSpell(
      session,
      { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" } },
      occasion,
    );
    const undone = undoLast(after);
    expect(undone.journal).toHaveLength(0);
    expect(undone.character).toEqual(session.character);
  });

  it("не растёт бесконечно", () => {
    let current = outOfCombat(session);
    for (let index = 0; index < 100 + 15; index += 1) {
      current = castSpell(
        current,
        { spell: spell("ray-of-frost"), mode: "cantrip", payment: { kind: "none" }, targetLabel: `цель ${index}` },
        occasion,
      );
      current = { ...current, character: { ...current.character, activeEffects: [] } };
    }
    expect(current.journal).toHaveLength(100);
  });

  it("записи содержат идентификатор заклинания и уровень ячейки", () => {
    const after = castSpell(
      session,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 3 } },
      occasion,
    );
    expect(after.journal[0]).toMatchObject({ spellId: "mage-armor", slotLevel: 3 });
  });
});

describe("экономия хода выводится из журнала (ADR-0008, FR-144)", () => {
  it("до первой отметки хода считает всё доступным", () => {
    const economy = deriveTurnEconomy(withTurnTracking(session));
    expect(economy).toMatchObject({ inFight: true, reactionAvailable: true, round: 1 });
  });

  it("вне боя всё доступно независимо от журнала", () => {
    let current = beginTurn(outOfCombat(session), occasion);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("считает раунды по отметкам начала хода", () => {
    // Отметка начала боя — она же первый ход, поэтому счёт открывается на единице без «Нового хода».
    let current = withTurnTracking(session);
    expect(deriveTurnEconomy(current).round).toBe(1);
    for (const expected of [2, 3, 4]) {
      current = beginTurn(current, occasion);
      expect(deriveTurnEconomy(current).round).toBe(expected);
    }
  });

  it("реакция, потраченная после начала хода, недоступна", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);

    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    const economy = deriveTurnEconomy(current);
    expect(economy.reactionAvailable).toBe(false);
  });

  it("реакция возвращается началом следующего хода, а не концом раунда", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    // Между ходами происходят другие события — реакция всё ещё потрачена.
    current = takeDamage(current, 4, occasion);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);

    current = beginTurn(current, occasion);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("«Знаки ограждения» тратят реакцию так же, как заклинание-реакция", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = spendRuneOnWardingSigil(current, occasion);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);
    expect(current.journal.at(-1)?.actionUsed).toBe("reaction");
  });

  it("отмена реакции возвращает доступность без отдельной логики", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    current = undoLast(current);
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(true);
  });

  it("кровавое колдовство расходует действие в терминах журнала", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = exchangeBlood(current, 3, occasion);
    expect(current.journal.at(-1)?.actionUsed).toBe("action");
    expect(deriveTurnEconomy(current).actionAvailable).toBe(false);
  });

  it("ритуал ничего не тратит внутри хода", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = castSpell(
      current,
      { spell: spell("find-familiar"), mode: "ritual", payment: { kind: "none" } },
      occasion,
    );
    expect(current.journal.at(-1)?.actionUsed).toBeUndefined();
    expect(deriveTurnEconomy(current).actionAvailable).toBe(true);
  });

  it("вывод и флаги состояния не расходятся", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    const steps: Array<(s: Session) => Session> = [
      (s) => castSpell(s, { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, occasion),
      (s) => castSpell(s, { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } }, occasion),
      (s) => beginTurn(s, occasion),
    ];
    for (const step of steps) {
      current = step(current);
      const economy = deriveTurnEconomy(current);
      expect(economy.reactionAvailable).toBe(deriveTurnEconomy(current).reactionAvailable);
      expect(economy.actionAvailable).toBe(deriveTurnEconomy(current).actionAvailable);
      expect(economy.bonusActionAvailable).toBe(
        deriveTurnEconomy(current).bonusActionAvailable,
      );
    }
  });
});

describe("регенерация тролля начисляется в начале хода (FR-182)", () => {
  it("восстанавливает хиты и пишет величину в журнал", () => {
    let current = takeDamage(session, 40, occasion);
    expect(current.character.hitPoints.current).toBe(20);
    current = beginTurn(current, occasion);
    expect(current.character.hitPoints.current).toBe(23);
    expect(current.journal.at(-1)?.summaryRu).toBe("Начало хода · регенерация +3");
  });

  it("не начисляет выше половины максимума", () => {
    const current = beginTurn(session, occasion);
    expect(current.character.hitPoints.current).toBe(60);
    expect(current.journal.at(-1)?.summaryRu).toBe("Начало хода");
  });

  it("не начисляет под подавлением огнём", () => {
    let current = takeDamage(session, 40, occasion);
    current = takeDamage(current, 1, occasion, { fire: true });
    const before = current.character.hitPoints.current;
    current = beginTurn(current, occasion);
    expect(current.character.hitPoints.current).toBe(before);
  });

  it("не начисляет под солнцем", () => {
    let current = takeDamage(session, 40, occasion);
    current = setSunlight(current, true, occasion);
    const before = current.character.hitPoints.current;
    current = beginTurn(current, occasion);
    expect(current.character.hitPoints.current).toBe(before);
  });

  it("не поднимает с нуля хитов", () => {
    let current = takeDamage(session, 60, occasion);
    current = beginTurn(current, occasion);
    expect(current.character.hitPoints.current).toBe(0);
  });

  it("не превышает максимум", () => {
    // 18 очков кровью сняли 54 хита максимума, мастер снял ещё два: действующий максимум — 4.
    const weakened = withMasterReduction(withBloodExchange(session.character, 18), 2);

    const nearlyFull: Session = { ...session, character: withDamage(weakened, 2) };
    // 2 из 4 — не ниже половины, регенерация не идёт.
    expect(beginTurn(nearlyFull, occasion).character.hitPoints.current).toBe(2);

    const low: Session = { ...session, character: withDamage(weakened, 3) };
    expect(beginTurn(low, occasion).character.hitPoints.current).toBe(4);
  });

  it("начисление отменяется вместе с началом хода", () => {
    const wounded = takeDamage(session, 40, occasion);
    const before = structuredClone(wounded.character);
    const undone = undoLast(beginTurn(wounded, occasion));
    expect(undone.character).toEqual(before);
  });
});

describe("активный эффект без указанной длительности", () => {
  it("создаётся с типом длительности, но без значения", () => {
    const vague: Spell = { ...spell("mage-armor"), duration: { type: "rounds" } };
    // Раундовый эффект держится только в бою: вне схватки раундов нет, и он истёк бы сразу.
    const after = castSpell(
      withTurnTracking(session),
      { spell: vague, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(after.character.activeEffects[0]?.duration).toEqual({ type: "rounds" });
  });

  it("особая длительность переносится как есть", () => {
    const special: Spell = { ...spell("mage-armor"), duration: { type: "special" } };
    const after = castSpell(
      session,
      { spell: special, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(after.character.activeEffects[0]?.duration).toEqual({ type: "until_spell_ends" });
  });

});

describe("обмен крови вне боя действие не расходует (FR-143, FR-170)", () => {
  it("на привале хиты уходят, а кэш действия остаётся нетронутым", () => {
    const after = exchangeBlood(outOfCombat(session), 2, occasion);
    expect(after.character.spellPoints.remaining).toBe(2);
    expect(deriveTurnEconomy(after).actionAvailable).toBe(true);
  });
});

describe("правка хитов: лечение и временные (FR-205, FR-206)", () => {
  function hurt(current: number): Session {
    return { ...session, character: { ...session.character, hitPoints: { current, maximumBase: 60, bloodReduction: 0, masterReduction: 0 } } };
  }

  it("лечение поднимает текущие хиты и пишется в журнал", () => {
    const after = heal(hurt(40), 12, occasion);
    expect(after.character.hitPoints.current).toBe(52);
    expect(after.journal.at(-1)?.summaryRu).toBe("Вылечено: 12");
  });

  it("выше максимума не поднимает и говорит об этом", () => {
    const after = heal(hurt(55), 20, occasion);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Вылечено: 5 (из 20: упёрлись в максимум)");
  });

  it("упирается в снижённый максимум, а не в исходный (FR-172)", () => {
    // Состояние берётся у настоящей операции: обмен уменьшает сам максимум, а `maximumReduction`
    // хранит только то, сколько предстоит вернуть по часу. Придуманная пара «максимум 60, снижение
    // 9» в жизни не встречается, и тест на ней подтверждал бы вычитание снижения дважды.
    const reduced = exchangeBlood(hurt(40), 3, occasion);
    expect(reduced.character.hitPoints).toEqual({ current: 31, maximumBase: 60, bloodReduction: 9, masterReduction: 0 });

    expect(heal(reduced, 30, occasion).character.hitPoints.current).toBe(51);
  });

  it("на полном здоровье отказывает, а не пишет пустую запись", () => {
    expect(() => heal(session, 5, occasion)).toThrow(/уже на максимуме/);
  });

  it.each([0, -3, 1.5])("отклоняет недопустимое лечение %s", (amount) => {
    expect(() => heal(hurt(40), amount, occasion)).toThrow(DomainError);
  });

  it("временные хиты записываются отдельным числом", () => {
    const after = grantTemporaryHitPoints(session, 8, occasion);
    expect(after.character.temporaryHitPoints).toBe(8);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Временные хиты: 8");
  });

  it("не складываются: меньшее значение отклоняется", () => {
    const granted = grantTemporaryHitPoints(session, 8, occasion);
    expect(() => grantTemporaryHitPoints(granted, 5, occasion)).toThrow(/не складываются/);
    expect(grantTemporaryHitPoints(granted, 10, occasion).character.temporaryHitPoints).toBe(10);
  });

  it.each([0, -1, 2.5])("отклоняет недопустимое значение %s", (amount) => {
    expect(() => grantTemporaryHitPoints(session, amount, occasion)).toThrow(DomainError);
  });

  it("урон идёт сначала по временным хитам", () => {
    const granted = grantTemporaryHitPoints(session, 8, occasion);
    const after = takeDamage(granted, 5, occasion);
    expect(after.character.temporaryHitPoints).toBe(3);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.journal.at(-1)?.summaryRu).toBe("Получено урона: 5, из них 5 временными хитами");
  });

  it("остаток урона сверх временных хитов бьёт по текущим", () => {
    const granted = grantTemporaryHitPoints(session, 8, occasion);
    const after = takeDamage(granted, 20, occasion);
    expect(after.character.temporaryHitPoints).toBe(0);
    expect(after.character.hitPoints.current).toBe(48);
  });

  it("лечение временные хиты не восстанавливает", () => {
    const spent = takeDamage(grantTemporaryHitPoints(hurt(40), 8, occasion), 20, occasion);
    expect(spent.character.temporaryHitPoints).toBe(0);
    expect(heal(spent, 10, occasion).character.temporaryHitPoints).toBe(0);
  });

  it("долгий отдых снимает временные хиты", () => {
    const granted = grantTemporaryHitPoints(session, 8, occasion);
    expect(longRest(granted, occasion).character.temporaryHitPoints).toBe(0);
  });
});

describe("окончание эффекта называет срок числом (FR-090)", () => {
  function endCondition(spellOverride: Partial<Spell>): string | undefined {
    const subject: Spell = { ...spell("mage-armor"), ...spellOverride };
    const after = castSpell(
      session,
      { spell: subject, mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
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
    // Заметка не меняет игровое состояние, поэтому журнал не засоряет.
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
   * ( требует минимум три на заклинание), а порядок показа виден только на нескольких.
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

  /** Идентификатор варианта берётся у самого варианта: его форму знает отыгрыш, а не прогон. */
  function variantId(
    current: Session,
    index: number,
    category: RoleplayCategory = "short",
  ): string {
    const variant = roleplayVariants(current.character, card, category)[index];
    if (variant === undefined) throw new Error(`нет варианта ${category} №${index}`);
    return variant.id;
  }

  // Своя сессия: ярлыки вариантов нужны при сборке прогонов, когда общая ещё не заведена.
  const pristine = createSession(createThorne());
  const short0 = variantId(pristine, 0);
  const short1 = variantId(pristine, 1);
  const short2 = variantId(pristine, 2);

  function texts(current: Session, category: RoleplayCategory = "short"): string[] {
    return roleplayVariants(current.character, card, category).map((variant) => variant.text);
  }

  function disableAll(current: Session, category: RoleplayCategory): Session {
    // Ярлыки берутся у целого списка заранее: отключённый вариант меняет порядок показа.
    let next = current;
    for (const [index] of card.roleplay.completeVariants[category].entries()) {
      next = toggleRoleplayDisabled(next, card, variantId(pristine, index, category));
    }
    return next;
  }

  it("без пометок показывает варианты в порядке карточки", () => {
    expect(texts(session)).toEqual(["Первый.", "Второй.", "Третий."]);
    expect(session.character.roleplayPreferences).toEqual({});
  });

  it("свой вариант показывается первым в своей категории", () => {
    const own = addRoleplayVariant(session, card.id, "short", "Не сегодня.", occasion);
    expect(texts(own)).toEqual(["Не сегодня.", "Первый.", "Второй.", "Третий."]);
    // Категории не смешиваются: свой вариант живёт только в той, куда написан.
    expect(texts(own, "atmospheric")).toEqual(["Атмосферный."]);
  });

  it("пустой свой вариант отклоняется, а не сохраняется пробелами", () => {
    expect(() => addRoleplayVariant(session, card.id, "short", "   ", occasion)).toThrow(DomainError);
  });

  it("любимый идёт раньше остальных, но позже своего", () => {
    let current = addRoleplayVariant(session, card.id, "short", "Не сегодня.", occasion);
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

    expect(() => toggleRoleplayDisabled(current, card, variantId(pristine, 0, "sarcastic"))).toThrow(
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
    let current = addRoleplayVariant(session, card.id, "sarcastic", "Опять?", occasion);
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
    const first = castSpell(session, { spell: original, ...request }, testOccasion());
    const second = castSpell(session, { spell: rewritten, ...request }, testOccasion());

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
    const prepared = togglePreparation(withRoom(), spell("detect-magic"), occasion);
    expect(prepared.character.preparedSpellIds).toContain("detect-magic");
    expect(prepared.journal.at(-1)?.summaryRu).toBe("Подготовлено: Обнаружение магии");

    const dropped = togglePreparation(prepared, spell("detect-magic"), occasion);
    expect(dropped.character.preparedSpellIds).not.toContain("detect-magic");
    expect(dropped.journal.at(-1)?.summaryRu).toBe("Снята подготовка: Обнаружение магии");
  });

  it("подготовка обратима (FR-111)", () => {
    const before = withRoom();
    const prepared = togglePreparation(before, spell("detect-magic"), occasion);
    expect(undoLast(prepared).character.preparedSpellIds).toEqual(
      before.character.preparedSpellIds,
    );
  });

  /** Персонаж на пределе в три заклинания: предел назначен мастером, набор занят целиком. */
  function atLimitOfThree(): Session {
    return {
      ...session,
      character: {
        ...session.character,
        activeEffects: [
          {
            id: "narrowed",
            nameRu: "Слово мастера",
            startedAt: "2026-08-08T00:00:00.000Z",
            duration: { type: "until_removed" },
            isConcentration: false,
            slotLevelUsed: 0,
            endConditionRu: "Пока мастер не снимет.",
            contributions: [{ stat: "preparedLimit", kind: "bonus", value: -8 }],
          },
        ],
        preparedSpellIds: session.character.spellbookSpellIds.slice(0, 3),
      },
    };
  }

  it("лимит — жёсткое ограничение, а не предупреждение (FR-101)", () => {
    // Единственное место, где приложение отказывает без «всё равно»: это правило подготовки, и
    // мастер здесь исключений не делает.
    expect(() => togglePreparation(atLimitOfThree(), spell("identify"), occasion)).toThrow(
      /Подготовлено 3 из 3/,
    );
  });

  it("снять подготовку на пределе можно: иначе набор было бы не пересобрать", () => {
    const full = atLimitOfThree();
    const first = full.character.preparedSpellIds[0]!;
    const after = togglePreparation(full, spell(first), occasion);
    expect(after.character.preparedSpellIds).toHaveLength(2);
  });

  it("набор Торна начинается ровно на пределе: 11 из 11 (FR-101)", () => {
    expect(session.character.preparedSpellIds).toHaveLength(LIMIT);
    expect(() => togglePreparation(session, spell("blink"), occasion)).toThrow(
      /Подготовлено 11 из 11/,
    );
  });

  it("заговор не готовится: он вне лимита и доступен всегда (FR-102)", () => {
    expect(() => togglePreparation(session, spell("ray-of-frost"), occasion)).toThrow(
      /Заговор не готовится/,
    );
  });

  it("заклинания вне книги подготовить нельзя (FR-100)", () => {
    const foreign: Spell = { ...spell("mage-armor"), id: "fireball", nameRu: "Огненный шар" };
    expect(() => togglePreparation(session, foreign, occasion)).toThrow(/нет в книге/);
  });

  it("ритуал готовится как обычное заклинание (FR-103)", () => {
    // говорит, что ритуалом его можно творить и без подготовки, а не что готовить нельзя:
    // подготовленный ритуал в бою творится за ячейку обычным временем.
    const after = togglePreparation(withRoom(), spell("identify"), occasion);
    expect(after.character.preparedSpellIds).toContain("identify");
  });
});

describe("материальные компоненты (FR-030, FR-268)", () => {
  const pearl = "жемчужина стоимостью не менее 100 зм";
  const ashes = "уголь, благовония и травы стоимостью 10 зм, сжигаемые в огне в латунной жаровне";

  /** Сколько компонента лежит в сумке: он вещь, и спрашивают о нём как о вещи. */
  function inBag(current: Session, nameRu: string): number {
    return Character.of(current.character).equipment.bagCount(Items.idFromName(nameRu));
  }

  const ritual = { mode: "ritual" as const, payment: { kind: "none" as const } };

  it("компонент покупается вещью, и журнал называет её словами карточки (FR-268)", () => {
    const bought = toggleMaterial(session, spell("identify"), occasion);
    expect(inBag(bought, pearl)).toBe(1);
    expect(bought.journal.at(-1)?.summaryRu).toBe(`Добавлено: ${pearl} (стало 1)`);

    const spent = toggleMaterial(bought, spell("identify"), occasion);
    expect(inBag(spent, pearl)).toBe(0);
    expect(spent.journal.at(-1)?.summaryRu).toBe(`Потрачено: ${pearl} (в сумке 0)`);
  });

  it("обратимо, как любой расход (FR-111)", () => {
    const bought = toggleMaterial(session, spell("identify"), occasion);
    expect(inBag(undoLast(bought), pearl)).toBe(0);
  });

  it("заклинанию без материального компонента отвечает причиной", () => {
    expect(() => toggleMaterial(session, spell("shield"), occasion)).toThrow(
      /материального компонента/,
    );
  });

  it("расходуемый компонент списывается сотворением и возвращается отменой", () => {
    const bought = toggleMaterial(session, spell("find-familiar"), occasion);
    expect(inBag(bought, ashes)).toBe(1);

    const cast = castSpell(bought, { spell: spell("find-familiar"), ...ritual }, occasion);
    expect(inBag(cast, ashes)).toBe(0);
    // Молча уменьшившийся запас читался бы за столом как ошибка приложения.
    expect(cast.journal.at(-1)?.summaryRu).toContain(`компонент израсходован: ${ashes}`);

    // Одна запись на одно нажатие: отмена возвращает и ритуал, и сгоревшее в нём.
    expect(inBag(undoLast(cast), ashes)).toBe(1);
  });

  it("нечему гореть — сотворение проходит молча", () => {
    const cast = castSpell(session, { spell: spell("find-familiar"), ...ritual }, occasion);

    expect(inBag(cast, ashes)).toBe(0);
    expect(cast.journal.at(-1)?.summaryRu).not.toContain("компонент");
  });
});

describe("кости хитов (FR-134)", () => {
  it("долгий отдых возвращает половину костей, округляя вниз (FR-134)", () => {
    // Кости тратит заклинание своим применением; здесь важен возврат, поэтому пул задан сразу.
    const spent = createSession(withSpentHitDice(session.character, 5));
    // Половина от семи — три: 2 + 3 = 5, а не все семь. Долгий бой обязан стоить.
    expect(longRest(spent, occasion).character.hitDice?.remaining).toBe(5);
  });

  it("возврат не переливается через край", () => {
    expect(longRest(session, occasion).character.hitDice?.remaining).toBe(7);
  });

  it("персонажу без костей отдых их не выдумывает", () => {
    const { hitDice: _none, ...withoutDice } = session.character;
    expect(longRest(createSession(withoutDice), occasion).character.hitDice).toBeUndefined();
  });
});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("возвращает и тратит руну, записывая обе правки", () => {
    const spent = adjustRunes(session, -1, occasion);
    expect(spent.character.runes.remaining).toBe(2);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачена руна: 2");

    const returned = adjustRunes(spent, 1, occasion);
    expect(returned.character.runes.remaining).toBe(3);
    expect(returned.journal.at(-1)?.summaryRu).toBe("Возвращена руна: 3");
  });

  it("за границы пула не выпускает", () => {
    expect(() => adjustRunes(session, 1, occasion)).toThrow(/от 0 до 3/);
    const empty = adjustRunes(adjustRunes(adjustRunes(session, -1, occasion), -1, occasion), -1, occasion);
    expect(() => adjustRunes(empty, -1, occasion)).toThrow(/от 0 до 3/);
  });

  it("ручное списание ячейки пишется в журнал и обратимо (FR-111)", () => {
    const spent = spendSpellSlot(session, 1, occasion);
    expect(spent.character.spellSlots[1]?.remaining).toBe(3);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Списана ячейка 1 уровня");
    expect(undoLast(spent).character.spellSlots[1]?.remaining).toBe(4);
  });

  it("правка руны обратима", () => {
    expect(undoLast(adjustRunes(session, -1, occasion)).character.runes.remaining).toBe(3);
  });
});

describe("конец боя (FR-216)", () => {
  function wounded(current: number): Session {
    return {
      ...session,
      character: { ...session.character, hitPoints: { current, maximumBase: 60, bloodReduction: 0, masterReduction: 0 } },
    };
  }

  it("поднимает здоровье до половины максимума", () => {
    const after = endCombat(wounded(12), occasion);
    expect(after.character.hitPoints.current).toBe(30);
    expect(after.journal.at(-1)?.summaryRu).toBe("Бой закончен: восстановлено 18 до половины максимума");
  });

  it("выше половины не поднимает: до полного здоровья регенерация не доводит", () => {
    expect(endCombat(wounded(29), occasion).character.hitPoints.current).toBe(30);
  });

  it("закончить бой можно и здоровым: конец боя — факт, а не лечение", () => {
    const after = endCombat(wounded(30), occasion);
    expect(after.character.hitPoints.current).toBe(30);
    expect(after.journal.at(-1)?.summaryRu).toBe("Бой закончен");
    expect(after.journal.at(-1)?.kind).toBe("combat_ended");
  });

  it("считает половину от снижённого максимума, а не от исходного (FR-172)", () => {
    // Обмен уменьшил максимум до 51 — половина от него 25, а не 30.
    const spent = exchangeBlood(wounded(20), 3, occasion);
    expect(combatEndRecovery(spent.character)).toBe(14);
    expect(endCombat(spent, occasion).character.hitPoints.current).toBe(25);
  });

  it("под солнцем конец боя не лечит: подавленная регенерация не идёт и вне схватки (FR-181)", () => {
    const sunlit = setSunlight(wounded(12), true, occasion);
    expect(combatEndRecovery(sunlit.character)).toBe(0);

    const after = endCombat(sunlit, occasion);
    expect(after.character.hitPoints.current).toBe(12);
    expect(after.journal.at(-1)?.summaryRu).toBe("Бой закончен");
  });

  it("сбитому с ног конец боя не лечит: при нуле хитов регенерация не идёт", () => {
    expect(combatEndRecovery(wounded(0).character)).toBe(0);
    expect(endCombat(wounded(0), occasion).character.hitPoints.current).toBe(0);
  });

  it("восстановление обратимо (FR-111)", () => {
    expect(undoLast(endCombat(wounded(12), occasion)).character.hitPoints.current).toBe(12);
  });

  it("сбрасывает счёт раундов: следующий бой начинается с первого", () => {
    let current = withTurnTracking(session);
    for (let round = 0; round < 4; round += 1) current = beginTurn(current, occasion);
    expect(deriveTurnEconomy(current).round).toBe(5);

    current = endCombat(current, occasion);
    expect(deriveTurnEconomy(current).round).toBe(1);
    expect(deriveTurnEconomy(current).inFight).toBe(false);

    current = beginTurn(current, occasion);
    expect(deriveTurnEconomy(current).round).toBe(1);
  });

  it("потраченное в прошлом бою нового не связывает", () => {
    let current = beginTurn(withTurnTracking(session), occasion);
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(deriveTurnEconomy(current).reactionAvailable).toBe(false);

    current = endCombat(current, occasion);
    expect(deriveTurnEconomy(current)).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: true,
      reactionAvailable: true,
    });
  });

  it("конец боя снимает раундовое", () => {
    let current = withTurnTracking(session);
    current = castSpell(
      current,
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    current = castSpell(
      current,
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      occasion,
    );
    expect(current.character.activeEffects.map((effect) => effect.nameRu)).toEqual([
      "Доспехи мага",
      "Щит",
    ]);

    const ended = endCombat(current, occasion);
    expect(ended.character.activeEffects.map((effect) => effect.nameRu)).toEqual(["Доспехи мага"]);
    expect(ended.journal.at(-1)?.summaryRu).toBe("Бой закончен: «Щит» истёк");
    expect(undoLast(ended).character.activeEffects).toHaveLength(2);
  });

  it("отмена возвращает и счёт раундов прежнего боя (FR-111)", () => {
    let current = withTurnTracking(session);
    for (let round = 0; round < 2; round += 1) current = beginTurn(current, occasion);
    const undone = undoLast(endCombat(current, occasion));
    expect(deriveTurnEconomy(undone).round).toBe(3);
  });
});

describe("почасовое восстановление максимума хитов и очков заклинаний (FR-173, FR-175)", () => {
  function afterExchange(): Session {
    return exchangeBlood(session, 3, occasion);
  }

  it("возвращает не больше, чем утрачено кровавым колдовством", () => {
    const spent = afterExchange();
    expect(spent.character.hitPoints).toEqual({ current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 });

    const recovered = recoverHitPointMaximum(spent, occasion);
    // На 7 уровне возвращается 3 за час.
    expect(recovered.character.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 6,
      masterReduction: 0,
    });
  });

  it("последний час возвращает только остаток", () => {
    let state = exchangeBlood(session, 2, occasion);
    state = recoverHitPointMaximum(state, occasion);
    expect(state.character.hitPoints).toEqual({ current: 54, maximumBase: 60, bloodReduction: 3, masterReduction: 0 });

    state = recoverHitPointMaximum(state, occasion);
    expect(state.character.hitPoints).toEqual({ current: 54, maximumBase: 60, bloodReduction: 0, masterReduction: 0 });
  });

  it("без снижения максимума, регенерации и очков восстанавливать нечего", () => {
    expect(() => recoverHitPointMaximum(session, occasion)).toThrow(DomainError);
  });

  it("очки заклинаний гаснут любым отмеченным часом, сколько бы их ни набежало", () => {
    const withPoints = afterExchange();
    expect(withPoints.character.spellPoints.remaining).toBe(3);

    const recovered = recoverHitPointMaximum(withPoints, occasion);
    expect(recovered.character.spellPoints.remaining).toBe(0);
    expect(recovered.journal.at(-1)?.summaryRu).toBe("Прошёл час: максимум +3, очки заклинаний погашены");
  });

  it("под подавлением максимум не восстанавливается, но очки гаснут независимо от него", () => {
    const recovered = recoverHitPointMaximum(setSunlight(afterExchange(), true, occasion), occasion);
    expect(recovered.character.hitPoints.bloodReduction).toBe(9);
    expect(recovered.character.spellPoints.remaining).toBe(0);
    expect(recovered.journal.at(-1)?.summaryRu).toBe("Прошёл час: очки заклинаний погашены");
  });

  it("под подавлением без непогашенных очков восстанавливать нечего: ни солнце, ни огонь", () => {
    // Очки уже потрачены на сотворение — остаётся только снижение, а его подавление и держит.
    const drained = castSpell(
      exchangeBlood(session, 2, occasion),
      { spell: spell("shield"), mode: "normal", payment: { kind: "spell_points" } },
      occasion,
    );
    expect(drained.character.spellPoints.remaining).toBe(0);
    expect(drained.character.hitPoints.bloodReduction).toBe(6);

    expect(() => recoverHitPointMaximum(setSunlight(drained, true, occasion), occasion)).toThrow(/солнеч/);

    const burned = takeDamage(drained, 5, occasion, { fire: true });
    expect(() => recoverHitPointMaximum(burned, occasion)).toThrow(/огн/);
  });

  it("во время боя час пройти не может, как и любая другая отметка схватки", () => {
    expect(() => recoverHitPointMaximum(withTurnTracking(afterExchange()), occasion)).toThrow(/бой/);
  });

  it("обратимо через журнал", () => {
    const recovered = recoverHitPointMaximum(afterExchange(), occasion);
    const undone = undoLast(recovered);
    expect(undone.character.hitPoints.bloodReduction).toBe(9);
    expect(undone.character.spellPoints.remaining).toBe(3);
  });

  it("час не только поднимает максимум, но и лечит: регенерация идёт непрерывно", () => {
    // Раненый обменом: 20 из 51 при снижении 9. За час максимум станет 54, а регенерация успевает
    // дойти до половины нового максимума — 27, а не 25 от прежнего.
    const wounded = takeDamage(afterExchange(), 31, occasion);
    expect(wounded.character.hitPoints.current).toBe(20);

    const recovered = recoverHitPointMaximum(wounded, occasion);
    expect(recovered.character.hitPoints).toEqual({ current: 27, maximumBase: 60, bloodReduction: 6, masterReduction: 0 });
    expect(recovered.journal.at(-1)?.summaryRu).toBe(
      "Прошёл час: максимум +3, регенерация +7, очки заклинаний погашены",
    );
  });

  it("одна регенерация тоже оправдывает час — без снижения максимума и без очков", () => {
    const injured: Session = {
      ...session,
      character: withDamage(session.character, 50),
    };
    const recovered = recoverHitPointMaximum(injured, occasion);
    expect(recovered.character.hitPoints.current).toBe(30);
    expect(recovered.journal.at(-1)?.summaryRu).toBe("Прошёл час: регенерация +20");
  });
})

describe("короткий отдых не делает того, что делает час", () => {
  it("ступень снижённого максимума остаётся на месте, а очки заклинаний не гаснут", () => {
    const wounded = takeDamage(exchangeBlood(session, 3, occasion), 31, occasion);
    expect(wounded.character.hitPoints).toEqual({ current: 20, maximumBase: 60, bloodReduction: 9, masterReduction: 0 });
    expect(wounded.character.spellPoints.remaining).toBe(3);

    // Регенерация вне схватки идёт непрерывно, поэтому до половины прежнего максимума — 51 — она
    // доходит и за эти минуты. Сам максимум при этом не растёт: ступень поднимает только час.
    const rested = shortRest(wounded, occasion);
    expect(rested.character.hitPoints).toEqual({ current: 25, maximumBase: 60, bloodReduction: 9, masterReduction: 0 });
    expect(rested.character.spellPoints.remaining).toBe(3);
    expect(rested.journal.at(-1)?.summaryRu).toBe("Короткий отдых · регенерация +5");
  });

  it("час после такого отдыха возвращает ступень и гасит очки — своё он делает по-прежнему", () => {
    const wounded = takeDamage(exchangeBlood(session, 3, occasion), 31, occasion);
    const afterHour = recoverHitPointMaximum(shortRest(wounded, occasion), occasion);

    expect(afterHour.character.hitPoints).toEqual({ current: 27, maximumBase: 60, bloodReduction: 6, masterReduction: 0 });
    expect(afterHour.character.spellPoints.remaining).toBe(0);
  });

  it("здоровому отдых пишется коротко", () => {
    expect(shortRest(session, occasion).journal.at(-1)?.summaryRu).toBe("Короткий отдых");
  });

  it("обожжённому короткий отдых регенерацию возвращает: отдых длиннее срока огня (FR-266)", () => {
    const burned = takeDamage(exchangeBlood(session, 3, occasion), 31, occasion, { fire: true });
    expect(Vitality.of(burned.character).firedUpon).toBe(true);

    const rested = shortRest(burned, occasion);
    expect(Vitality.of(rested.character).firedUpon).toBe(false);
    expect(rested.character.hitPoints.current).toBe(25);
    expect(rested.journal.at(-1)?.summaryRu).toBe("Короткий отдых · регенерация +5");
  });

  it("под солнцем короткий отдых не лечит: признак его переживает (FR-181)", () => {
    const wounded = takeDamage(exchangeBlood(session, 3, occasion), 31, occasion);
    const rested = shortRest(setSunlight(wounded, true, occasion), occasion);

    expect(rested.character.suppression.underDirectSunlight).toBe(true);
    expect(rested.character.hitPoints.current).toBe(20);
    expect(rested.journal.at(-1)?.summaryRu).toBe("Короткий отдых");
  });

  it("магическое восстановление отдых открывает по-прежнему (FR-131)", () => {
    expect(arcaneRecoveryUnavailability(session)).toBe("Берётся после короткого отдыха");
    expect(arcaneRecoveryUnavailability(shortRest(session, occasion))).toBeNull();
  });

  it("в бою отдых отказывает и называет свою длительность (FR-215)", () => {
    const fighting = startCombat(session, occasion);

    expect(shortRestUnavailability(fighting)).toBe(
      "Пока идёт бой, короткий отдых недоступен: 10 минут между двумя ходами не проходят",
    );
    expect(() => shortRest(fighting, occasion)).toThrow(DomainError);
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
    const original = castSpell(session, { spell: ritual, ...request }, testOccasion());
    const other = castSpell(session, { spell: repainted, ...request }, testOccasion());

    expect(other.character).toEqual(original.character);
    expect(other.journal.map((entry) => entry.summaryRu)).toEqual(
      original.journal.map((entry) => entry.summaryRu),
    );
  });
});

describe("сотворённое вне боя не переносится в бой (FR-145, FR-095)", () => {
  it("вне боя действие не записывается: в бою оно остаётся целым", () => {
    const occasion = testOccasion();
    const session = castSpell(
      { character: createThorne(), journal: [] },
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 }, allowAnyway: false },
      occasion,
    );

    expect(session.journal.at(-1)?.actionUsed).toBeUndefined();
    expect(deriveTurnEconomy(startCombat(session, occasion)).actionAvailable).toBe(true);
  });

  it("в бою действие записывается по-прежнему", () => {
    const occasion = testOccasion();
    const session = castSpell(
      startCombat({ character: createThorne(), journal: [] }, occasion),
      { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 }, allowAnyway: false },
      occasion,
    );

    expect(session.journal.at(-1)?.actionUsed).toBe("action");
    expect(deriveTurnEconomy(session).actionAvailable).toBe(false);
  });

  it("раундовый эффект вне боя истекает сразу: КД не входит в бой", () => {
    const occasion = testOccasion();
    const session = castSpell(
      { character: createThorne(), journal: [] },
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 }, allowAnyway: false },
      occasion,
    );

    expect(session.character.activeEffects).toEqual([]);
    expect(session.journal.at(-1)?.summaryRu).toContain("вне боя раундов нет");
  });

  it("в бою раундовый эффект остаётся висеть", () => {
    const occasion = testOccasion();
    const session = castSpell(
      startCombat({ character: createThorne(), journal: [] }, occasion),
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 }, allowAnyway: false },
      occasion,
    );

    expect(session.character.activeEffects.map((effect) => effect.spellId)).toEqual(["shield"]);
  });

  it("ячейка тратится в обоих случаях: сотворить игрок выбрал сам", () => {
    const occasion = testOccasion();
    const session = castSpell(
      { character: createThorne(), journal: [] },
      { spell: spell("shield"), mode: "normal", payment: { kind: "slot", slotLevel: 1 }, allowAnyway: false },
      occasion,
    );

    expect(session.character.spellSlots[1]?.remaining).toBe(3);
  });
});

describe("расход костей хитов заклинанием (FR-135)", () => {
  /** Раненый Торн: 30 из 60, все семь костей целы. */
  function wounded() {
    const character = withDamage(createThorne(), 30);
    return createSession(character);
  }

  it("сотворение тратит кости хитов и лечит", () => {
    const after = castSpell(
      wounded(),
      {
        spell: spell("arcane-vigor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        hitDice: { count: 2, rolled: 9 },
      },
      occasion,
    );
    expect(after.character.hitDice?.remaining).toBe(5);
    // 30 + выпавшие 9 + модификатор Интеллекта 4.
    expect(after.character.hitPoints.current).toBe(43);
    expect(after.character.spellSlots[2]?.remaining).toBe(2);
  });

  it("одна запись журнала называет и кости, и восстановленное", () => {
    const after = castSpell(
      wounded(),
      {
        spell: spell("arcane-vigor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        hitDice: { count: 2, rolled: 9 },
      },
      occasion,
    );
    expect(after.journal).toHaveLength(1);
    expect(after.journal[0]?.summaryRu).toContain("2 кости");
    expect(after.journal[0]?.summaryRu).toContain("13");
  });

  it("отмена возвращает ячейку, кости и хиты разом (FR-111)", () => {
    const before = wounded();
    const after = castSpell(
      before,
      {
        spell: spell("arcane-vigor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        hitDice: { count: 2, rolled: 9 },
      },
      occasion,
    );
    const undone = undoLast(after);
    expect(undone.character.hitDice?.remaining).toBe(7);
    expect(undone.character.hitPoints.current).toBe(30);
    expect(undone.character.spellSlots[2]?.remaining).toBe(3);
  });

  it("на полных хитах сотворение проходит, но не лечит", () => {
    const after = castSpell(
      session,
      {
        spell: spell("arcane-vigor"),
        mode: "normal",
        payment: { kind: "slot", slotLevel: 2 },
        hitDice: { count: 1, rolled: 6 },
      },
      occasion,
    );
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.character.hitDice?.remaining).toBe(6);
    expect(after.journal[0]?.summaryRu).toContain("хиты уже на максимуме");
  });

  it("у персонажа без костей вовсе — отказ с нулём: поле необязательное ради чужих выгрузок", () => {
    const { hitDice: _absent, ...withoutDice } = createThorne();
    expect(() =>
      castSpell(
        createSession(withoutDice),
        {
          spell: spell("arcane-vigor"),
          mode: "normal",
          payment: { kind: "slot", slotLevel: 2 },
          hitDice: { count: 1, rolled: 4 },
        },
        occasion,
      ),
    ).toThrow("Неистраченных Костей хитов 0, а брошено 1");
  });

  it("костей меньше запрошенного — отказ, это несогласованность, а не выбор игрока", () => {
    const character = withSpentHitDice(createThorne(), 6);
    expect(() =>
      castSpell(
        createSession(character),
        {
          spell: spell("arcane-vigor"),
          mode: "normal",
          payment: { kind: "slot", slotLevel: 2 },
          hitDice: { count: 2, rolled: 7 },
        },
        occasion,
      ),
    ).toThrow(DomainError);
  });
});

describe("отметка короткого отдыха (FR-131)", () => {
  it("короткий отдых её ставит", () => {
    expect(shortRest(session, occasion).character.shortRestSinceLongRest).toBe(true);
  });

  it("долгий отдых её снимает: восстановление снова ждёт короткого", () => {
    const rested = shortRest(session, occasion);
    expect(longRest(rested, occasion).character.shortRestSinceLongRest).toBe(false);
  });

  it("свежий персонаж отдыха ещё не знал", () => {
    expect(session.character.shortRestSinceLongRest ?? false).toBe(false);
  });

  it("сохранение прежней версии открывается без поля (NFR-003)", () => {
    const { shortRestSinceLongRest: _omitted, ...withoutFlag } = createThorne();
    expect(characterStateSchema.safeParse(withoutFlag).success).toBe(true);
  });

  it("без короткого отдыха магическое восстановление отклоняется (FR-131)", () => {
    expect(() => useArcaneRecovery(spendSpellSlot(session, 1, occasion), { 1: 1 }, occasion)).toThrow(
      /Берётся после короткого отдыха/,
    );
  });
});
