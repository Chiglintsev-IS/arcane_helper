import { describe, expect, it } from "vitest";

import { fieldsOf } from "./fields";

describe("поля значения непроверенной формы", () => {
  it("объект отдаёт свои поля", () => {
    expect(fieldsOf({ level: 7, armorClass: { base: 10 } })).toEqual({
      level: 7,
      armorClass: { base: 10 },
    });
  });

  it("вложенное значение остаётся тем же: копия только внешняя", () => {
    const nested = { base: 10 };
    expect(fieldsOf({ armorClass: nested }).armorClass).toBe(nested);
  });

  it("правка полей не задевает исходное значение", () => {
    const stored = { level: 7 };
    const fields = fieldsOf(stored);
    fields.level = 1;
    expect(stored.level).toBe(7);
  });

  it("у значения, которое не объект, полей нет", () => {
    expect(fieldsOf("не состояние")).toEqual({});
    expect(fieldsOf(null)).toEqual({});
    expect(fieldsOf(undefined)).toEqual({});
  });
});
