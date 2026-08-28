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
import {
  withIngredientKnowledge,
  withSpentSlots,
  withoutHitDice,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import type { CharacterState } from "@/core/domain/assembly/state";

import { answerQuestion } from "./previewer";

/** Время выгрузки: часы приходят снаружи, и прогон называет своё. */
const NOW = "2026-07-31T18:00:00.000Z";

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
    }, NOW);

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: 60 });
  });

  it("невозможному набору отвечает пустотой, а не отказом: игрок ещё печатает", () => {
    const preview = answerQuestion(alive(), {
      kind: "health_preview",
      maximumBase: 0,
      masterReduction: 0,
    }, NOW);

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: null });
  });

  it("вопрос состояния не двигает", () => {
    const live = alive();
    const before = live.session.character;

    answerQuestion(live, { kind: "health_preview", maximumBase: 70, masterReduction: 0 }, NOW);

    expect(live.session.character).toBe(before);
    expect(live.session.log).toHaveLength(0);
  });
});

describe("уровень", () => {
  it("сдвиг ячейки едет вместе с её уровнем", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 }, NOW);

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "slots",
      slotLevel: 4,
      before: 1,
      after: 2,
    });
  });

  it("сдвиг величины без уровня ячейки едет без него", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 9 }, NOW);

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "runes",
      before: 3,
      after: 4,
    });
  });

  it("невозможному уровню отвечать нечем: ни сдвигов, ни средней прибавки", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 21 }, NOW);

    expect(preview).toEqual({ kind: "level_preview", changes: [], hitPoints: null });
  });

  it("среднее за взятый уровень едет слагаемыми: кость бросает игрок", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 }, NOW);

    expect(preview.kind === "level_preview" && preview.hitPoints).toMatchObject({ total: 7 });
  });
});

describe("сотворение", () => {
  const slotOne = { kind: "slot", slotLevel: 1 } as const;

  type CastAsk = Extract<Parameters<typeof answerQuestion>[1], { kind: "cast_preview" }>;

  /** Обычное сотворение — умолчание вопроса: режим спрашивают только там, где он и проверяется. */
  function castPreview(question: Omit<CastAsk, "kind" | "mode"> & { mode?: string }) {
    const preview = answerQuestion(alive(), { kind: "cast_preview", mode: "normal", ...question }, NOW);
    return preview.kind === "cast_preview" ? preview : null;
  }

  it("эффекты рун считаются по выбранной ячейке", () => {
    const first = castPreview({ spellId: "mage-armor", payment: slotOne });
    const fourth = castPreview({ spellId: "mage-armor", payment: { kind: "slot", slotLevel: 4 } });

    expect(first?.runes.effects).toHaveLength(3);
    expect(first?.runes.effects[0]?.effectRu).not.toEqual(fourth?.runes.effects[0]?.effectRu);
  });

  it("руна называет себя и говорит, выбирает ли цель: выбирает одна из трёх", () => {
    const preview = castPreview({ spellId: "mage-armor", payment: slotOne });

    const chooses = preview?.runes.effects.filter((effect) => effect.choosesTarget) ?? [];
    expect(chooses.map((effect) => effect.rune)).toEqual(["life"]);
    expect(chooses[0]?.nameRu).toBe("Руна жизни");
  });

  it("руна при оплате кровью считается от уровня сотворения", () => {
    const preview = castPreview({
      spellId: "mage-armor",
      payment: { kind: "blood", castLevel: 3 },
    });

    expect(preview?.runes.unavailabilityRu).toBeUndefined();
    expect(preview?.runes.effects.find((effect) => effect.rune === "life")?.effectRu).toContain(
      "15 временных хитов",
    );
  });

  it("у ритуала уровня сотворения нет, и руна не предлагается вовсе", () => {
    const preview = castPreview({
      spellId: "alarm",
      mode: "ritual",
      payment: { kind: "none" },
    });

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

  it("без уровня сотворения кости считаются по уровню заклинания", () => {
    const ritual = castPreview({
      spellId: "arcane-vigor",
      mode: "ritual",
      payment: { kind: "none" },
    });

    // Ритуал уровня сотворения не даёт, и повышения нет: столько же, сколько за свой уровень.
    expect(ritual?.hitDice?.maximum).toBe(2);
  });

  it("заклинанию без костей хитов отвечать про них нечем", () => {
    expect(castPreview({ spellId: "mage-armor", payment: slotOne })?.hitDice).toBeUndefined();
  });

  it("оплата кровью считает кости по оплаченному уровню сотворения", () => {
    const own = castPreview({
      spellId: "arcane-vigor",
      payment: { kind: "blood", castLevel: 2 },
    });
    const raised = castPreview({
      spellId: "arcane-vigor",
      payment: { kind: "blood", castLevel: 3 },
    });

    // Кровь повышает сотворение так же, как ячейка старшего уровня, и кости растут вместе с ним.
    expect(own?.hitDice?.maximum).toBe(2);
    expect(raised?.hitDice?.maximum).toBe(4);
  });

  it("истраченные кости бросать нечем, но сотворить всё равно можно", () => {
    const spent = answerQuestion(alive(withoutHitDice(createThorne())), {
      kind: "cast_preview",
      spellId: "arcane-vigor",
      mode: "normal",
      payment: { kind: "slot", slotLevel: 2 },
    }, NOW);

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
    }, NOW);

    expect(preview.kind === "cast_preview" && preview.hitDice).toEqual({ maximum: 0, modifier: 4 });
  });

  it("вопрос состояния не двигает", () => {
    const live = alive();
    const before = live.session.character;

    answerQuestion(live, {
      kind: "cast_preview",
      spellId: "mage-armor",
      mode: "normal",
      payment: slotOne,
    }, NOW);

    expect(live.session.character).toBe(before);
    expect(live.session.log).toHaveLength(0);
  });
});

describe("магическое восстановление", () => {
  function plan(spent: Record<string, number>, character: CharacterState = createThorne()) {
    const preview = answerQuestion(alive(character), {
      kind: "arcane_recovery_preview",
      plan: spent,
    }, NOW);
    return preview.kind === "arcane_recovery_preview" ? preview : null;
  }

  it("считает суммарный уровень набранного: им и меряется дневной бюджет", () => {
    const spent = withSpentSlots(withSpentSlots(createThorne(), 1, 2), 3, 1);

    expect(plan({ 1: 2, 3: 1 }, spent)?.levelsSpent).toBe(5);
  });

  it("набранное сверх бюджета отвечает причиной словами владельца, а не молчанием", () => {
    // Дневной бюджет Торна — четыре уровня, а набрано пять.
    const spent = withSpentSlots(withSpentSlots(createThorne(), 4, 1), 1, 1);
    const answer = plan({ 4: 1, 1: 1 }, spent);

    expect(answer?.levelsSpent).toBe(5);
    expect(answer?.unavailabilityRu).toBeDefined();
  });

  it("годному плану причины не называет вовсе", () => {
    const spent = withSpentSlots(createThorne(), 1, 1);

    expect(plan({ 1: 1 }, spent)?.unavailabilityRu).toBeUndefined();
  });
});

describe("цена исследования", () => {
  const MOON_HERB = "Лунная трава";

  function cost(
    number: number,
    rarity: string,
    direction: string,
    character: CharacterState = withIngredientKnowledge(createThorne(), MOON_HERB),
  ) {
    const preview = answerQuestion(alive(character), {
      kind: "research_preview",
      nameRu: MOON_HERB,
      number,
      rarity,
      direction,
    }, NOW);
    return preview.kind === "research_preview" ? preview : null;
  }

  it("цена исследования приходит вопросом и состояния не трогает", () => {
    const character = withIngredientKnowledge(createThorne(), MOON_HERB);
    const live = alive(character);
    const before = JSON.stringify(live.session.character);

    const answer = cost(1, "common", "potions", character);

    // Десять минут против пятёрки: первое свойство надёжным походным комплектом.
    expect(answer?.plan?.minutes).toBe(10);
    expect(answer?.plan?.difficulty).toBe(5);
    // Порция теряется только при провале, и материалов эта глубина ещё не жжёт.
    expect(answer?.plan?.portionsOnSuccess).toBe(0);
    expect(answer?.plan?.portionsOnFailure).toBe(1);
    expect(answer?.plan?.consumablesRu).toBeNull();
    expect(answer?.plan?.rawSampleRu).toContain("Сырая проба");
    expect(answer?.refusalRu).toBeUndefined();
    expect(JSON.stringify(live.session.character)).toBe(before);
  });

  it("цена исследования отказывает словами владельца", () => {
    // Набора по синтезу ядов у Торна нет: работать нечем, и отказ называет чем именно.
    expect(cost(1, "common", "poisons")?.plan).toBeNull();
    expect(cost(1, "common", "poisons")?.refusalRu).toContain("без профильного оснащения");

    // Порядок стережёт сам вид: цену свойства, до которого не добрались, называть незачем.
    expect(cost(2, "common", "potions")?.refusalRu).toContain("номером 1");

    // Слово не из тех, что бывают, — тот же отказ с причиной, а не падение.
    expect(cost(1, "невиданная", "potions")?.refusalRu).toContain("не из тех");
    expect(cost(1, "common", "алхимия")?.refusalRu).toContain("не из тех");
  });

  it("глубина и редкость поднимают цену, а лаборатория ставит предел", () => {
    const twice = withIngredientKnowledge(createThorne(), MOON_HERB, [
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
    ]);

    // Второе свойство: час работы, базовая двенадцать плюс два за редкость, комплект за час.
    const second = cost(2, "rare", "potions", twice);
    expect(second?.plan?.difficulty).toBe(14);
    expect(second?.plan?.consumablesRu).toBe("Обычные");
    expect(second?.plan?.consumablesGold).toBe(1);

    const deep = withIngredientKnowledge(createThorne(), MOON_HERB, [
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
      { number: 2, nameRu: "Временное здоровье", rarity: "uncommon" },
    ]);
    expect(cost(3, "common", "potions", deep)?.refusalRu).toContain("стационарной лаборатории");
  });
});
