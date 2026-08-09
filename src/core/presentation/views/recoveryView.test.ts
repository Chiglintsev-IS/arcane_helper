/**
 * Проекция восстановления: обещание кнопки и отказ операции — одна и та же фраза.
 *
 * Проверяется не то, что причина «какая-то», а то, что она дословно совпадает с отказом самой
 * операции: разошедшись, они бы гасили кнопку одним поводом и объясняли другим.
 */

import { describe, expect, it } from "vitest";

import { createSession, type Occasion, type Session } from "@/core/application/session";
import { recoverHitPointMaximum } from "@/core/application/useCases/health";
import { longRest, shortRest, useArcaneRecovery } from "@/core/application/useCases/rest";
import { startCombat } from "@/core/application/useCases/turn";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withBloodExchange,
  withDamage,
  withoutArcaneRecovery,
} from "@/core/infrastructure/catalog/thorne/fixtures";

import { toRecoveryView } from "./recoveryView";

const OCCASION: Occasion = {
  now: () => "2026-07-31T18:00:00.000Z",
  nextId: () => "id-1",
  commandId: "command-1",
};

function fresh(character = createThorne()): Session {
  return createSession(character);
}

function inFight(character = createThorne()): Session {
  return startCombat(createSession(character), OCCASION);
}

/** Чем ответит операция, если её всё-таки вызвать. */
function refusalOf(run: () => Session): string {
  try {
    run();
  } catch (error: unknown) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

describe("следующий час", () => {
  it("называет возврат максимума, регенерацию и очки, которые сгорят", () => {
    const session = fresh(withDamage(withBloodExchange(createThorne(), 2), 40));

    const { nextHour } = toRecoveryView(session);

    expect(nextHour.maximumReturned).toBeGreaterThan(0);
    expect(nextHour.healed).toBeGreaterThan(0);
    expect(nextHour.spellPointsLost).toBe(2);
  });

  it("целому персонажу обещает три нуля, а не отсутствие часа", () => {
    const { nextHour } = toRecoveryView(fresh());

    expect(nextHour).toMatchObject({ maximumReturned: 0, healed: 0, spellPointsLost: 0 });
    expect(nextHour.unavailabilityRu).toBeUndefined();
  });

  it("в бою называет ту же причину, которой откажет сам час", () => {
    const session = inFight(withBloodExchange(createThorne(), 2));

    expect(toRecoveryView(session).nextHour.unavailabilityRu).toBe(
      refusalOf(() => recoverHitPointMaximum(session, OCCASION)),
    );
  });
});

describe("конец боя", () => {
  it("называет, сколько вернёт регенерация вне схватки", () => {
    const wounded = fresh(withDamage(createThorne(), 40));

    expect(toRecoveryView(wounded).combatEndRecovery).toBeGreaterThan(0);
  });

  it("здоровому обещает ноль: лечить нечего", () => {
    expect(toRecoveryView(fresh()).combatEndRecovery).toBe(0);
  });
});

describe("отдых", () => {
  it("вне боя не называет причин: оба отдыха идут", () => {
    const view = toRecoveryView(fresh());

    expect(view.shortRestUnavailabilityRu).toBeUndefined();
    expect(view.longRestUnavailabilityRu).toBeUndefined();
  });

  it("в бою называет те же причины, которыми откажут сами отдыхи", () => {
    const session = inFight();
    const view = toRecoveryView(session);

    expect(view.shortRestUnavailabilityRu).toBe(refusalOf(() => shortRest(session, OCCASION)));
    expect(view.longRestUnavailabilityRu).toBe(refusalOf(() => longRest(session, OCCASION)));
  });
});

describe("магическое восстановление", () => {
  it("остаток дневного бюджета виден до нажатия", () => {
    expect(toRecoveryView(fresh()).arcaneRecovery.remaining).toBeGreaterThan(0);
  });

  it("вне боя причина приходит от самой операции", () => {
    const session = fresh();

    expect(toRecoveryView(session).arcaneRecovery.unavailabilityRu).toBe(
      refusalOf(() => useArcaneRecovery(session, { 1: 1 }, OCCASION)),
    );
  });

  it("бой перекрывает собственную причину операции", () => {
    const session = inFight();

    expect(toRecoveryView(session).arcaneRecovery.unavailabilityRu).toBe(
      refusalOf(() => useArcaneRecovery(session, { 1: 1 }, OCCASION)),
    );
  });

  it("исчерпанный бюджет не мешает назвать остаток нулём", () => {
    const view = toRecoveryView(fresh(withoutArcaneRecovery(createThorne())));

    expect(view.arcaneRecovery.remaining).toBe(0);
    expect(view.arcaneRecovery.unavailabilityRu).toBeDefined();
  });
});
