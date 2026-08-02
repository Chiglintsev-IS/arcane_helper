/**
 * Правило видимости категории: показывается та, что делит список.
 *
 * Проверяется на настоящей книге Торна и на её боевом составе: перечня категорий по режимам больше
 * нет, и единственный способ убедиться, что набор верен в обеих ситуациях, — посчитать его от
 * обоих списков.
 */

import { describe, expect, it } from "vitest";

import { dividingCategories } from "@/ui/features/filter-spells/model/filters";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { spellsForScreen } from "@/ui/shared/model/spellList";

const SPELLS = loadThorneSpells();

function categoriesOf(inFight: boolean) {
  return dividingCategories(spellsForScreen(SPELLS, createThorne(), inFight), inFight);
}

describe("dividingCategories", () => {
  it("категория, которой отвечает весь список, переключателя не получает", () => {
    const allConcentrating = SPELLS.filter((spell) => spell.concentration);
    expect(dividingCategories(allConcentrating, false).concentration).toBe(false);
  });

  it("категория, которой не отвечает никто, переключателя не получает", () => {
    const noRituals = SPELLS.filter((spell) => !spell.ritual);
    expect(dividingCategories(noRituals, false).ritual).toBe(false);
  });

  it("пустой список не предлагает ничего", () => {
    const empty = dividingCategories([], false);

    expect(empty.prices).toEqual([]);
    expect(empty.castingTimes.size).toBe(0);
    expect(empty.roles.size).toBe(0);
    expect(empty.concentration).toBe(false);
    expect(empty.ritual).toBe(false);
  });

  it("«Ритуал» спрашивает про способ, а не про признак: в бою его нет", () => {
    expect(categoriesOf(false).ritual).toBe(true);
    expect(categoriesOf(true).ritual).toBe(false);
  });

  it("цена считается тем же ключом, что и порядок: вне боя ритуал стоит ноль", () => {
    // Заговоры и ритуалы стоят ноль, дальше идут уровни ячейки — те, что в списке есть.
    expect(categoriesOf(false).prices).toEqual([0, 1, 2, 3, 4]);
    expect(categoriesOf(true).prices).toEqual([0, 1, 2, 3, 4]);
  });

  it("время накладывания следует составу: долгого в бою нет", () => {
    // Вне боя «Починка» и «Опознание» делят список минутами; в бою их там нет вовсе.
    expect(categoriesOf(false).castingTimes.has("minute")).toBe(true);
    expect(categoriesOf(true).castingTimes.has("minute")).toBe(false);
  });
});
