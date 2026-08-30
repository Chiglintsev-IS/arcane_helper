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

const arcaneLock = spell("arcane-lock");
const mageArmor = spell("mage-armor");
const shield = spell("shield");

describe("материал заклинания", () => {
  it("компонент заклинания опознаётся вещью с ценой и судьбой из карточки (FR-268)", () => {
    expect(materialOf(arcaneLock.components)).toEqual({
      id: "золотая-пыль-стоимостью-минимум-25-зм,-расходуемая-заклинанием",
      nameRu: "золотая пыль стоимостью минимум 25 зм, расходуемая заклинанием",
      kinds: ["consumable"],
      consumed: true,
      price: { amount: 25, currency: "gold" },
    });
  });

  it("вещи без цены цена не выдумывается", () => {
    expect(materialOf(mageArmor.components)).toEqual({
      id: "кусок-обработанной-кожи",
      nameRu: "кусок обработанной кожи",
      kinds: [],
      consumed: false,
    });
  });

  it("заклинание без материала вещи не называет", () => {
    expect(materialOf(shield.components)).toBeUndefined();
  });

  it("материала нет у того, кто его не назвал: сумке нечего искать", () => {
    const unnamed: Spell = {
      ...arcaneLock,
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
    expect(materialCoveredByFocus(arcaneLock.components, createThorne())).toBe(false);
  });

  it("заклинанию без материала закрывать нечего", () => {
    expect(materialCoveredByFocus(shield.components, createThorne())).toBe(false);
  });
});

describe("кому нужна вещь", () => {
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
    expect(needs[0]?.spellId).toBe("первое");
  });

  it("закрытое фокусировкой требование остаётся требованием (FR-295)", () => {
    const withFocus = materialNeeds([mageArmor, arcaneLock], createThorne());
    expect(withFocus.map((need) => need.coveredByFocus)).toEqual([true, false]);

    const bare = materialNeeds([mageArmor, arcaneLock], withoutSpellcastingFocus(createThorne()));
    expect(bare.map((need) => need.coveredByFocus)).toEqual([false, false]);

    const alsoBurnt: Spell = {
      ...arcaneLock,
      components: { ...arcaneLock.components, materialText: "кусок обработанной кожи" },
    };
    expect(materialNeeds([mageArmor, alsoBurnt], createThorne())[0]?.coveredByFocus).toBe(false);
  });

  it("заклинание без материала в нужду не попадает", () => {
    expect(materialNeeds([shield], createThorne())).toEqual([]);
  });
});
