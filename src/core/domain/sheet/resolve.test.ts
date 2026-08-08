import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import type { StatContribution } from "@/core/domain/shared/stats";

import { breakdownOf, defineStat, ownCandidate, resolveStats } from "./resolve";

/** Величина с собственным способом счёта: десятка, как у Класса Доспеха без доспехов. */
const plain = defineStat({ id: "armorClass", methods: () => [ownCandidate(10)] });

/** Величина, у которой собственного способа нет: считается только принесённым. */
const brought = defineStat({
  id: "speed",
  methods: (_read, methods) =>
    methods.map((method) => ({ value: method.base, grownFrom: method })),
});

function from(...contributions: StatContribution[]) {
  return contributions.map((contribution, index) => ({
    source: `источник ${index}`,
    contribution,
  }));
}

const bonus = (value: number): StatContribution => ({ stat: "armorClass", kind: "bonus", value });
const assignment = (value: number): StatContribution => ({
  stat: "armorClass",
  kind: "assignment",
  value,
});

describe("свёртка вкладов", () => {
  it("порядок вкладов на итог не влияет", () => {
    const forward = resolveStats([plain], from(bonus(5), bonus(-2), bonus(1)));
    const backward = resolveStats([plain], from(bonus(1), bonus(-2), bonus(5)));

    expect(forward.get("armorClass")?.value).toBe(14);
    expect(backward.get("armorClass")?.value).toBe(14);
  });

  it("назначение побеждает всё: ни способ счёта, ни прибавки его не двигают", () => {
    const resolved = resolveStats([plain], from(bonus(5), assignment(18), bonus(100)));

    expect(resolved.get("armorClass")?.value).toBe(18);
  });

  it("из применимых способов действует наибольший по итогу, и они не складываются", () => {
    const resolved = resolveStats(
      [brought],
      from(
        { stat: "speed", kind: "method", method: { family: "spell", base: 13 } },
        { stat: "speed", kind: "method", method: { family: "spell", base: 16 } },
      ),
    );

    expect(resolved.get("speed")?.value).toBe(16);
  });

  it("диапазон приводит итог в конце счёта, поверх всех вкладов", () => {
    const limited = defineStat({
      id: "preparedLimit",
      range: { minimum: 1, maximum: 20 },
      methods: () => [ownCandidate(11)],
    });

    expect(
      resolveStats([limited], from({ stat: "preparedLimit", kind: "bonus", value: -50 })).get(
        "preparedLimit",
      )?.value,
    ).toBe(1);
    expect(
      resolveStats([limited], from({ stat: "preparedLimit", kind: "bonus", value: 50 })).get(
        "preparedLimit",
      )?.value,
    ).toBe(20);
    expect(
      resolveStats([limited], from(assignment(999))).get("preparedLimit")?.value,
    ).toBe(11);
  });

  it("без единого вклада действует собственный способ величины", () => {
    expect(resolveStats([plain], []).get("armorClass")?.value).toBe(10);
  });

  it("величина без единого способа счёта считается от нуля", () => {
    const nothing = defineStat({ id: "speed", methods: () => [] });

    expect(resolveStats([nothing], []).get("speed")?.value).toBe(0);
    expect(resolveStats([nothing], from({ stat: "speed", kind: "bonus", value: 4 })).get("speed")?.value).toBe(4);
  });

  it("диапазон бывает односторонним: нижний предел без верхнего и наоборот", () => {
    const floored = defineStat({ id: "speed", range: { minimum: 0 }, methods: () => [ownCandidate(5)] });
    const capped = defineStat({ id: "speed", range: { maximum: 3 }, methods: () => [ownCandidate(5)] });
    const drain = { stat: "speed", kind: "bonus", value: -50 } as const;

    expect(resolveStats([floored], from(drain)).get("speed")?.value).toBe(0);
    expect(resolveStats([capped], from(drain)).get("speed")?.value).toBe(-45);
    expect(resolveStats([capped], []).get("speed")?.value).toBe(3);
  });

  it("величины, которую сборщик пропустил, разбор не выдаёт нулём", () => {
    const resolved = resolveStats([plain], []);

    expect(breakdownOf(resolved, "armorClass").value).toBe(10);
    expect(() => breakdownOf(resolved, "speed")).toThrow("сборщик её пропустил");
  });
});

describe("разбор", () => {
  it("вклад возвращается с тем же источником, каким пришёл", () => {
    const resolved = resolveStats([plain], [
      { source: "кольцо защиты", contribution: bonus(1) },
    ]);

    expect(resolved.get("armorClass")?.parts).toEqual([
      { source: "кольцо защиты", contribution: bonus(1), applied: true },
    ]);
  });

  it("проигравший способ счёта из разбора не пропадает, но в итог не входит", () => {
    const weaker: StatContribution = {
      stat: "speed",
      kind: "method",
      method: { family: "spell", base: 13 },
    };
    const stronger: StatContribution = {
      stat: "speed",
      kind: "method",
      method: { family: "armor", base: 16, category: "heavy" },
    };
    const resolved = resolveStats([brought], [
      { source: "Доспехи мага", contribution: weaker },
      { source: "кольчуга", contribution: stronger },
    ]);

    expect(resolved.get("speed")?.parts).toEqual([
      { source: "Доспехи мага", contribution: weaker, applied: false },
      { source: "кольчуга", contribution: stronger, applied: true },
    ]);
  });

  it("перебитая назначением прибавка видна в разборе неприменённой", () => {
    const resolved = resolveStats([plain], from(bonus(5), assignment(18)));
    const parts = resolved.get("armorClass")?.parts ?? [];

    expect(parts.map((part) => part.applied)).toEqual([false, true]);
  });

  it("второе назначение в итог не входит: единственность держит владелец вкладов", () => {
    const resolved = resolveStats([plain], from(assignment(18), assignment(20)));

    expect(resolved.get("armorClass")?.value).toBe(18);
    expect(resolved.get("armorClass")?.parts.map((part) => part.applied)).toEqual([true, false]);
  });
});

describe("зависимости величины", () => {
  it("величина читает объявленную зависимость", () => {
    const dependent = defineStat({
      id: "initiative",
      from: [plain],
      methods: (read) => [ownCandidate(read(plain) * 2)],
    });

    expect(resolveStats([dependent], []).get("initiative")?.value).toBe(20);
  });

  it("зависимость считается со своими вкладами, и они доходят до зависимой величины", () => {
    const dependent = defineStat({
      id: "initiative",
      from: [plain],
      methods: (read) => [ownCandidate(read(plain))],
    });

    expect(resolveStats([dependent], from(assignment(18))).get("initiative")?.value).toBe(18);
  });

  it("чтение мимо объявленных зависимостей — отказ с причиной", () => {
    const sneaky = defineStat({
      id: "initiative",
      methods: (read) => [ownCandidate(read(plain))],
    });

    expect(() => resolveStats([sneaky], [])).toThrow("armorClass");
  });

  it("вклад к Классу Доспеха, читающий Класс Доспеха, не собирается", () => {
    const compiled = spawnSync(
      "node_modules/.bin/tsc",
      ["--noEmit", "-p", "scripts/samples/tsconfig.json"],
      { encoding: "utf8" },
    );

    expect(compiled.status).not.toBe(0);
    expect(compiled.stdout).toContain("armorClass");
  }, 60_000);
});
