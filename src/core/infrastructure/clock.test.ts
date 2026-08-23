import { describe, expect, it } from "vitest";

import { systemClock } from "./clock";

describe("системные часы", () => {
  it("дают время в ISO", () => {
    expect(Number.isNaN(Date.parse(systemClock().now()))).toBe(false);
  });

  it("дают разные идентификаторы: на одинаковых лог потерял бы записи", () => {
    const clock = systemClock();

    expect(clock.nextId()).not.toBe(clock.nextId());
  });
});
