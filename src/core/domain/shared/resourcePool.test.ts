import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { ResourcePool } from "@/core/domain/shared/resourcePool";

const RU = "Рун";

describe("пул ресурса", () => {
  it("хранит максимум и остаток", () => {
    const pool = ResourcePool.from({ maximum: 3, remaining: 2 }, RU);
    expect(pool.maximum).toBe(3);
    expect(pool.remaining).toBe(2);
    expect(pool.depleted).toBe(false);
  });

  it("пустой пул называет себя исчерпанным", () => {
    expect(ResourcePool.from({ maximum: 3, remaining: 0 }, RU).depleted).toBe(true);
  });

  it("трата уменьшает остаток", () => {
    expect(ResourcePool.from({ maximum: 3, remaining: 3 }, RU).spend(RU).remaining).toBe(2);
  });

  it("возврат увеличивает остаток", () => {
    expect(ResourcePool.from({ maximum: 3, remaining: 1 }, RU).shift(1, RU).remaining).toBe(2);
  });

  it("восстановление поднимает остаток до максимума", () => {
    expect(ResourcePool.from({ maximum: 3, remaining: 0 }, RU).restored().remaining).toBe(3);
  });

  it("за границы не выпускает: причина названа числом", () => {
    const pool = ResourcePool.from({ maximum: 3, remaining: 0 }, RU);
    expect(() => pool.spend(RU)).toThrow(DomainError);
    expect(() => pool.spend(RU)).toThrow("Рун может быть от 0 до 3, получилось -1");
    expect(() => pool.shift(4, RU)).toThrow("Рун может быть от 0 до 3, получилось 4");
  });

  it("испорченное хранимое состояние отвергает при сборке, а не молча чинит", () => {
    expect(() => ResourcePool.from({ maximum: 3, remaining: 5 }, RU)).toThrow(
      "Рун: осталось 5 при максимуме 3",
    );
    expect(() => ResourcePool.from({ maximum: 3, remaining: -1 }, RU)).toThrow(DomainError);
  });

  it("отдаёт состояние обратно тем же, чем приняла", () => {
    expect(ResourcePool.from({ maximum: 2, remaining: 1 }, RU).toState()).toEqual({
      maximum: 2,
      remaining: 1,
    });
  });
});

describe("смена максимума", () => {
  it("прибавка максимума приходит неистраченной", () => {
    const pool = ResourcePool.from({ maximum: 1, remaining: 0 }, RU);
    expect(pool.resized(2).toState()).toEqual({ maximum: 2, remaining: 1 });
  });

  it("убыль максимума обрезает остаток, но не уводит его ниже нуля", () => {
    const full = ResourcePool.from({ maximum: 3, remaining: 3 }, RU);
    expect(full.resized(1).toState()).toEqual({ maximum: 1, remaining: 1 });
    const spent = ResourcePool.from({ maximum: 3, remaining: 0 }, RU);
    expect(spent.resized(1).toState()).toEqual({ maximum: 1, remaining: 0 });
  });
});
