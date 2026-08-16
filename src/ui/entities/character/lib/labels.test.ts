import { describe, expect, it } from "vitest";

import { currencyAbbr, DERIVED_LABELS, skillLabel } from "./labels";

describe("подписи навыков", () => {
  it("навык зовётся именем бумажного листа", () => {
    // Три имени из восемнадцати расходились с листом игрока; остальные пятнадцать с ним совпадают
    // и здесь не перечисляются — их держит сам словарь подписей.
    expect(skillLabel("arcana")).toBe("Аркана");
    expect(skillLabel("investigation")).toBe("Анализ");
    expect(skillLabel("perception")).toBe("Внимательность");
  });

  it("величина, выведенная из навыка, носит его имя", () => {
    // Иначе «Лист» и шапка «Игры» зовут одно двумя словами, и второе имя приходится переводить.
    expect(DERIVED_LABELS.passivePerception.toLowerCase()).toContain(
      skillLabel("perception").toLowerCase(),
    );
  });
});

describe("слово вне словаря подписей", () => {
  it("монета, которой словарь ещё не знает, доезжает до экрана своим словом", () => {
    // Договор ручается за непустую строку, а не за перечень монет, и тем же разбором читает снимок
    // от бэкенда, который вправе знать монет больше. Пропасть монете нельзя: число осталось бы на
    // экране без монеты, которую считает.
    expect(currencyAbbr("platinum")).toBe("platinum");
  });
});
