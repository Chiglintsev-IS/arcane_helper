/**
 * Ответ на вопрос: набранное, посчитанное владельцем правила.
 *
 * Проверяется главное свойство вопроса — он ничего не меняет: предпросмотр невозможной правки
 * приходит ответом, а не отказом, и состояние после вопроса то же, что до него.
 */

import { describe, expect, it } from "vitest";

import { createSession, type LiveSession } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { withoutHitDice } from "@/core/infrastructure/catalog/thorne/fixtures";
import type { CharacterState } from "@/core/domain/assembly/state";

import { answerQuestion } from "./previewer";

function alive(character: CharacterState = createThorne()): LiveSession {
  return {
    session: createSession(character),
    spellCatalog: loadThorneSpells(),
    spellCatalogSource: "built_in",
  };
}

describe("здоровье", () => {
  it("называет действующий максимум по набранному, а не по сохранённому", () => {
    const preview = answerQuestion(alive(), {
      kind: "health_preview",
      maximumBase: 70,
      masterReduction: 10,
    });

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: 60 });
  });

  it("невозможному набору отвечает пустотой, а не отказом: игрок ещё печатает", () => {
    const preview = answerQuestion(alive(), {
      kind: "health_preview",
      maximumBase: 0,
      masterReduction: 0,
    });

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: null });
  });

  it("вопрос состояния не двигает", () => {
    const live = alive();
    const before = live.session.character;

    answerQuestion(live, { kind: "health_preview", maximumBase: 70, masterReduction: 0 });

    expect(live.session.character).toBe(before);
    expect(live.session.journal).toHaveLength(0);
  });
});

describe("уровень", () => {
  it("сдвиг ячейки едет вместе с её уровнем", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 });

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "slots",
      slotLevel: 4,
      before: 1,
      after: 2,
    });
  });

  it("сдвиг величины без уровня ячейки едет без него", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 9 });

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "runes",
      before: 3,
      after: 4,
    });
  });

  it("невозможному уровню отвечать нечем: ни сдвигов, ни средней прибавки", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 21 });

    expect(preview).toEqual({ kind: "level_preview", changes: [], hitPoints: null });
  });

  it("среднее за взятый уровень едет слагаемыми: кость бросает игрок", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 });

    expect(preview.kind === "level_preview" && preview.hitPoints).toMatchObject({ total: 7 });
  });
});

describe("сотворение", () => {
  const slotOne = { kind: "slot", slotLevel: 1 } as const;

  type CastAsk = Extract<Parameters<typeof answerQuestion>[1], { kind: "cast_preview" }>;

  /** Обычное сотворение — умолчание вопроса: режим спрашивают только там, где он и проверяется. */
  function castPreview(question: Omit<CastAsk, "kind" | "mode"> & { mode?: string }) {
    const preview = answerQuestion(alive(), { kind: "cast_preview", mode: "normal", ...question });
    return preview.kind === "cast_preview" ? preview : null;
  }

  it("объявление называет выбранную ячейку, а не собственный уровень заклинания", () => {
    const third = castPreview({
      spellId: "lightning-bolt",
      payment: { kind: "slot", slotLevel: 4 },
    });

    expect(third?.announcement.text).toContain("4");
  });

  it("незаполненная подстановка едет пробелом с причиной, а не выдумкой", () => {
    const preview = castPreview({
      spellId: "shocking-grasp",
      mode: "cantrip",
      payment: { kind: "none" },
    });

    expect(preview?.announcement.gaps.map((gap) => gap.placeholder)).toContain("target");
  });

  it("эффекты рун считаются по выбранной ячейке", () => {
    const first = castPreview({ spellId: "mage-armor", payment: slotOne });
    const fourth = castPreview({ spellId: "mage-armor", payment: { kind: "slot", slotLevel: 4 } });

    expect(first?.runes.effects).toHaveLength(3);
    expect(first?.runes.effects[0]?.effectRu).not.toEqual(fourth?.runes.effects[0]?.effectRu);
  });

  it("при оплате кровью руна не предлагается вовсе, и причина названа", () => {
    const preview = castPreview({ spellId: "mage-armor", payment: { kind: "spell_points" } });

    expect(preview?.runes.effects).toEqual([]);
    expect(preview?.runes.unavailabilityRu).toBeDefined();
  });

  it("костей позволяет тем больше, чем выше ячейка", () => {
    const second = castPreview({ spellId: "arcane-vigor", payment: { kind: "slot", slotLevel: 2 } });
    const third = castPreview({ spellId: "arcane-vigor", payment: { kind: "slot", slotLevel: 3 } });

    expect(second?.hitDice?.maximum).toBe(2);
    expect(third?.hitDice?.maximum).toBe(4);
  });

  it("границы возможного появляются вместе с набранным числом костей", () => {
    const chosen = castPreview({
      spellId: "arcane-vigor",
      payment: { kind: "slot", slotLevel: 2 },
      hitDiceCount: 2,
    });

    expect(chosen?.hitDice?.roll).toEqual({ minimum: 2, maximum: 12 });
    expect(chosen?.hitDice?.rollPossible).toBeUndefined();
  });

  it("невозможное выпавшее названо невозможным, а возможное складывается с модификатором", () => {
    const impossible = castPreview({
      spellId: "arcane-vigor",
      payment: { kind: "slot", slotLevel: 2 },
      hitDiceCount: 2,
      hitDiceRolled: 13,
    });
    const possible = castPreview({
      spellId: "arcane-vigor",
      payment: { kind: "slot", slotLevel: 2 },
      hitDiceCount: 2,
      hitDiceRolled: 7,
    });

    expect(impossible?.hitDice?.rollPossible).toBe(false);
    // Модификатор заклинательной характеристики Торна — +4, и прибавляется он один раз.
    expect(possible?.hitDice?.restored).toBe(11);
  });

  it("заклинанию без костей хитов отвечать про них нечем", () => {
    expect(castPreview({ spellId: "mage-armor", payment: slotOne })?.hitDice).toBeUndefined();
  });

  it("оплата кровью считает кости по собственному уровню заклинания", () => {
    const blood = castPreview({ spellId: "arcane-vigor", payment: { kind: "spell_points" } });

    // Ячейки нет, значит и повышения нет: тот же максимум, что у ячейки своего уровня.
    expect(blood?.hitDice?.maximum).toBe(2);
  });

  it("истраченные кости бросать нечем, но сотворить всё равно можно", () => {
    const spent = answerQuestion(alive(withoutHitDice(createThorne())), {
      kind: "cast_preview",
      spellId: "arcane-vigor",
      mode: "normal",
      payment: { kind: "slot", slotLevel: 2 },
    });

    expect(spent.kind === "cast_preview" && spent.hitDice).toMatchObject({ maximum: 0 });
  });

  it("без записи о костях хитов отвечать нечем даже про максимум", () => {
    // Состояние пришло из сборки, которая про кости не знала: поля нет вовсе, и это не ноль.
    const { hitDice: _none, ...withoutPool } = createThorne();
    const preview = answerQuestion(alive(withoutPool), {
      kind: "cast_preview",
      spellId: "arcane-vigor",
      mode: "normal",
      payment: { kind: "slot", slotLevel: 2 },
      hitDiceCount: 2,
    });

    expect(preview.kind === "cast_preview" && preview.hitDice).toEqual({ maximum: 0, modifier: 4 });
  });

  it("названная цель и приложенная руна попадают в объявление", () => {
    const preview = castPreview({
      spellId: "mage-armor",
      payment: slotOne,
      targetLabel: "на себя",
      rune: "war",
    });

    expect(preview?.announcement.text).toContain("на себя");
    expect(preview?.announcement.text).toContain("руну войны");
    expect(preview?.instructions.join(" ")).toContain("руна войны");
  });

  it("вопрос состояния не двигает", () => {
    const live = alive();
    const before = live.session.character;

    answerQuestion(live, {
      kind: "cast_preview",
      spellId: "mage-armor",
      mode: "normal",
      payment: slotOne,
    });

    expect(live.session.character).toBe(before);
    expect(live.session.journal).toHaveLength(0);
  });
});

describe("обмен крови на очки", () => {
  function exchange(points: number) {
    const preview = answerQuestion(alive(), { kind: "blood_exchange_preview", points });
    return preview.kind === "blood_exchange_preview" ? preview : null;
  }

  it("цена набранного считается по курсу ступени: у Торна три хита за очко", () => {
    const preview = exchange(2);

    expect(preview?.hitPointsSpent).toBe(6);
    expect(preview?.maximumAfter).toBe(preview!.hitPointsAfter);
  });

  it("называет наибольший уровень, который оплатят накопленные очки", () => {
    expect(exchange(2)?.affordableSpellLevel).toBe(1);
  });

  it("на одно очко не хватает ни на что", () => {
    expect(exchange(1)?.affordableSpellLevel).toBeNull();
  });

  it("шаги и объявление приходят готовыми к столу", () => {
    const preview = exchange(2);

    expect(preview?.instructions.length).toBeGreaterThan(0);
    expect(preview?.announcement).toContain("6");
  });
});
