import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { withoutSpellcastingFocus } from "@/core/infrastructure/catalog/thorne/fixtures";
import type { Spell } from "@/core/domain/catalog/spell";
import { materialCoveredByFocus, materialNeeds, materialOf } from "@/core/application/casting/material";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

const identify = spell("identify");
const findFamiliar = spell("find-familiar");
const mageArmor = spell("mage-armor");
const shield = spell("shield");

describe("материал заклинания", () => {
  it("компонент заклинания опознаётся вещью с ценой и судьбой из карточки (FR-268)", () => {
    expect(materialOf(identify.components)).toEqual({
      id: "жемчужина-стоимостью-не-менее-100-зм",
      nameRu: "жемчужина стоимостью не менее 100 зм",
      kind: "other",
      consumed: false,
      price: { amount: 100, currency: "gold" },
    });

    // Судьба компонента — его категория: сжигаемое ритуалом тратится счётом, как всякий расходник.
    expect(materialOf(findFamiliar.components)).toMatchObject({
      kind: "consumable",
      consumed: true,
      price: { amount: 10, currency: "gold" },
    });
  });

  it("вещи без цены цена не выдумывается", () => {
    expect(materialOf(mageArmor.components)).toEqual({
      id: "кусок-обработанной-кожи",
      nameRu: "кусок обработанной кожи",
      kind: "other",
      consumed: false,
    });
  });

  it("заклинание без материала вещи не называет", () => {
    expect(materialOf(shield.components)).toBeUndefined();
  });

  it("материала нет у того, кто его не назвал: сумке нечего искать", () => {
    // Объявление карточки такого не пропускает: материал обязан быть назван словами. Приложение
    // всё равно не выдумывает вещи — назвать её нечем, и в сумке она не нашлась бы никогда.
    const unnamed: Spell = {
      ...identify,
      components: { verbal: true, somatic: true, material: true, consumed: true },
    };
    expect(materialOf(unnamed.components)).toBeUndefined();
  });
});

describe("что закрывает фокусировка", () => {
  it("компонент без стоимости закрыт, пока фокусировка надета", () => {
    expect(materialCoveredByFocus(mageArmor.components, createThorne())).toBe(true);
    expect(materialCoveredByFocus(mageArmor.components, withoutSpellcastingFocus(createThorne()))).toBe(
      false,
    );
  });

  it("названную стоимость и расход не закрывает ничто", () => {
    expect(materialCoveredByFocus(identify.components, createThorne())).toBe(false);
    expect(materialCoveredByFocus(findFamiliar.components, createThorne())).toBe(false);
  });

  it("заклинанию без материала закрывать нечего", () => {
    expect(materialCoveredByFocus(shield.components, createThorne())).toBe(false);
  });
});

describe("кому нужна вещь", () => {
  /** Заклинание, называющее чужой компонент своими словами: карточки такое допускают. */
  function naming(source: Spell, id: string, nameRu: string, materialText: string): Spell {
    return { ...source, id, nameRu, components: { ...source.components, materialText } };
  }

  it("один компонент на два заклинания назван обоими (FR-295)", () => {
    const wool = "кусок шерсти";
    const needs = materialNeeds(
      [
        naming(mageArmor, "первое", "Первое", wool),
        naming(mageArmor, "второе", "Второе", wool),
        mageArmor,
      ],
      createThorne(),
    );

    expect(needs.map((need) => need.material.nameRu)).toEqual([wool, "кусок обработанной кожи"]);
    expect(needs[0]?.spellNamesRu).toEqual(["Первое", "Второе"]);
    // Заводят вещь той карточкой, которая назвала её первой: цену и судьбу она называет сама.
    expect(needs[0]?.spellId).toBe("первое");
  });

  it("закрытое фокусировкой требование остаётся требованием (FR-295)", () => {
    const withFocus = materialNeeds([mageArmor, identify], createThorne());
    expect(withFocus.map((need) => need.coveredByFocus)).toEqual([true, false]);

    // Фокусировку сняли — требование то же самое, и оно снова срочно.
    const bare = materialNeeds([mageArmor, identify], withoutSpellcastingFocus(createThorne()));
    expect(bare.map((need) => need.coveredByFocus)).toEqual([false, false]);

    // Дешёвый компонент, названный ещё и тем, кто его сжигает, срочен у обоих: сжигаемое не закрыто.
    const alsoBurnt: Spell = {
      ...findFamiliar,
      components: { ...findFamiliar.components, materialText: "кусок обработанной кожи" },
    };
    expect(materialNeeds([mageArmor, alsoBurnt], createThorne())[0]?.coveredByFocus).toBe(false);
  });

  it("заклинание без материала в нужду не попадает", () => {
    expect(materialNeeds([shield], createThorne())).toEqual([]);
  });
});
