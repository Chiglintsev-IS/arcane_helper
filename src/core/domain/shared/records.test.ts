import { describe, expect, it } from "vitest";

import { recordOf } from "./records";

describe("запись по замкнутому списку ключей", () => {
  it("каждый ключ списка получает своё значение", () => {
    expect(recordOf(["north", "south"], (key) => key.length)).toEqual({ north: 5, south: 5 });
  });

  it("пустому списку соответствует пустая запись", () => {
    expect(recordOf([], () => 0)).toEqual({});
  });
});
