import { describe, expect, it } from "vitest";

import { DERIVED_LABELS, skillLabel } from "./labels";

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
