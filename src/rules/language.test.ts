import { describe, expect, it } from "vitest";

import { plural, withPlural } from "./language";

const POINTS: [string, string, string] = ["очко", "очка", "очков"];

describe("plural", () => {
  it.each([
    [1, "очко"],
    [2, "очка"],
    [4, "очка"],
    [5, "очков"],
    [11, "очков"],
    [14, "очков"],
    [21, "очко"],
    [22, "очка"],
    [25, "очков"],
    [0, "очков"],
  ])("%i — %s", (count, expected) => {
    expect(plural(count, POINTS)).toBe(expected);
  });

  it("отрицательное число берёт форму по модулю: остаток тоже бывает в минусе", () => {
    expect(plural(-1, POINTS)).toBe("очко");
  });
});

describe("withPlural", () => {
  it("склеивает число со словом", () => {
    expect(withPlural(6, ["хит", "хита", "хитов"])).toBe("6 хитов");
  });
});
