import { describe, expect, it } from "vitest";

import { alchemyDirectionOf, isAlchemicalPropertyName } from "./alchemy";

/**
 * Перечень свойств из справочника стола.
 *
 * В исходнике он свёрстан тремя столбцами, и столбцы кончаются не одновременно: зельеварение и
 * синтез ядов идут до конца таблицы, трансмутация обрывается раньше. Разбор, который читает строку
 * целиком, на этом месте либо теряет хвост длинных столбцов, либо дописывает трансмутации чужое, —
 * поэтому здесь названы концы всех трёх столбцов, а не только начала.
 */
describe("перечень алхимических свойств", () => {
  it("перечень свойств закрыт: выдуманное название не признаётся", () => {
    expect(isAlchemicalPropertyName("Лечение здоровья")).toBe(true);
    expect(isAlchemicalPropertyName("лечит")).toBe(false);
    expect(isAlchemicalPropertyName("Лечение здоровья ")).toBe(false);
    expect(isAlchemicalPropertyName("")).toBe(false);
  });

  it("направление читается по названию свойства", () => {
    expect(alchemyDirectionOf("Лечение здоровья")).toBe("potions");
    expect(alchemyDirectionOf("Ядовитый урон")).toBe("poisons");
    expect(alchemyDirectionOf("Взрыв")).toBe("transmutation");
  });

  it("столбцы справочника дочитаны до конца, включая тот, что кончается раньше", () => {
    expect(alchemyDirectionOf("Жидкая удача")).toBe("potions");
    expect(alchemyDirectionOf("Скрытое носительство болезни")).toBe("poisons");
    expect(alchemyDirectionOf("Хаотическая мутация материи")).toBe("transmutation");
  });

  it("свойство соседнего столбца не приписано трансмутации", () => {
    expect(alchemyDirectionOf("Пророческое видение")).toBe("potions");
    expect(alchemyDirectionOf("Нарушение сна")).toBe("poisons");
    expect(alchemyDirectionOf("Создание временного голема")).toBe("transmutation");
  });
});
