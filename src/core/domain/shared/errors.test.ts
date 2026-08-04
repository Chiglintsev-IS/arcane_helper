import { describe, expect, it } from "vitest";

import { DomainError, refusalReason } from "./errors";

describe("причина отказа словами", () => {
  it("отказ владельца отдаётся словами: их показывают там, где набирали", () => {
    expect(refusalReason(new DomainError("Рун не осталось"))).toBe("Рун не осталось");
  });

  it("сбой идёт дальше: правилом игры он не притворяется", () => {
    const failure = new TypeError("нет такого поля");
    expect(() => refusalReason(failure)).toThrow(failure);
  });
});
