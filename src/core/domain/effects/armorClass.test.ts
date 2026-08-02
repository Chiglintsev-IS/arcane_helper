import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import type { ArmorClassEffect, Spell } from "@/core/domain/catalog/spell";
import { armorClassWithSpell, effectiveArmorClass } from "@/core/domain/effects/armorClass";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/** Активный эффект с заданным вкладом: остальные поля к расчёту КД отношения не имеют. */
function effect(spellId: string, armorClass?: ArmorClassEffect): ActiveEffect {
  return {
    id: `effect-${spellId}`,
    spellId,
    nameRu: spellId,
    type: "buff",
    startedAt: "2026-07-31T12:00:00.000Z",
    duration: { type: "hours", value: 8 },
    isConcentration: false,
    slotLevelUsed: 1,
    endConditionRu: "До истечения длительности.",
    ...(armorClass === undefined ? {} : { armorClass }),
  };
}

function withEffects(...effects: ActiveEffect[]): CharacterState {
  return { ...createThorne(), activeEffects: effects };
}

const MAGE_ARMOR: ArmorClassEffect = { kind: "base_override", value: 13 };
const SHIELD: ArmorClassEffect = { kind: "bonus", value: 5 };

describe("effectiveArmorClass: числа с листа персонажа", () => {
  it("без эффектов складывает базу, Ловкость и предметы: 10 + 2 + 2 = 14", () => {
    expect(effectiveArmorClass(createThorne())).toBe(14);
  });

  it("«Доспехи мага» заменяют базу: 13 + 2 + 2 = 17", () => {
    expect(effectiveArmorClass(withEffects(effect("mage-armor", MAGE_ARMOR)))).toBe(17);
  });

  it("«Щит» прибавляется к итогу: 10 + 2 + 2 + 5 = 19", () => {
    expect(effectiveArmorClass(withEffects(effect("shield", SHIELD)))).toBe(19);
  });

  it("«Доспехи мага» и «Щит» вместе: 13 + 2 + 2 + 5 = 22", () => {
    const character = withEffects(effect("mage-armor", MAGE_ARMOR), effect("shield", SHIELD));
    expect(effectiveArmorClass(character)).toBe(22);
  });
});

describe("effectiveArmorClass: как складываются вклады", () => {
  it("эффект без вклада в КД итог не меняет", () => {
    expect(effectiveArmorClass(withEffects(effect("detect-magic")))).toBe(14);
  });

  it("две замены базы не суммируются — действует наибольшая", () => {
    const character = withEffects(
      effect("mage-armor", MAGE_ARMOR),
      effect("другое", { kind: "base_override", value: 16 }),
    );
    expect(effectiveArmorClass(character)).toBe(20);
  });

  it("замена ниже собственной базы не ухудшает КД", () => {
    const armored: CharacterState = {
      ...createThorne(),
      equipment: { ...createThorne().equipment, armorClassBase: 15 },
      activeEffects: [effect("mage-armor", MAGE_ARMOR)],
    };
    expect(effectiveArmorClass(armored)).toBe(19);
  });

  it("прибавки суммируются", () => {
    const character = withEffects(
      effect("shield", SHIELD),
      effect("другое", { kind: "bonus", value: 2 }),
    );
    expect(effectiveArmorClass(character)).toBe(21);
  });
});

describe("armorClassWithSpell: КД до подтверждения применения", () => {
  it("считает КД так, как будто выбранное заклинание уже действует", () => {
    expect(armorClassWithSpell(createThorne(), spell("mage-armor"))).toBe(17);
  });

  it("складывает вклад выбранного заклинания с уже активными эффектами", () => {
    const character = withEffects(effect("mage-armor", MAGE_ARMOR));
    expect(armorClassWithSpell(character, spell("shield"))).toBe(22);
  });

  it("заклинание без вклада в КД даёт текущий КД", () => {
    expect(armorClassWithSpell(createThorne(), spell("detect-magic"))).toBe(14);
  });

  it("повторное применение того же заклинания не удваивает вклад", () => {
    const character = withEffects(effect("mage-armor", MAGE_ARMOR));
    expect(armorClassWithSpell(character, spell("mage-armor"))).toBe(17);
  });

  it("состояние персонажа не изменяется расчётом (FR-022)", () => {
    const character = createThorne();
    armorClassWithSpell(character, spell("mage-armor"));
    expect(character.activeEffects).toEqual([]);
    expect(effectiveArmorClass(character)).toBe(14);
  });
});
