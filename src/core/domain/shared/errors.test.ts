import { describe, expect, it } from "vitest";

import { DomainError, refusalOf } from "./errors";

describe("отказ и дефект", () => {
  it("отказ по правилам называется словами, а дефект остаётся исключением", () => {
    expect(refusalOf(new DomainError("Ячеек не осталось"))).toBe("Ячеек не осталось");

    const defect = new TypeError("не функция");
    expect(() => refusalOf(defect)).toThrow(defect);
  });
});
