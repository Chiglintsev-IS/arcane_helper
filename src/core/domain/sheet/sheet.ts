/**
 * Лист — итог: то, что действует за столом прямо сейчас.
 *
 * Персонаж отвечает, кто он сам по себе; снаряжение — чем он располагает; лист складывает одно с
 * другим. Отдельный контекст нужен потому, что складывать некому иначе: ни персонаж, ни снаряжение
 * друг о друге не знают и знать не должны — иначе снятое кольцо правило бы характеристики, а
 * инвентарь оказался бы внутри персонажа.
 *
 * Здесь же живёт перебивка: она перекрывает не основание, а итог.
 */

import { CharacterBase } from "@/core/domain/character/base";
import type { Ability, SkillId } from "@/core/domain/character/skills";
import type { CharacterState } from "@/core/domain/character/state";
import { Equipment } from "@/core/domain/equipment/equipment";
import {
  DERIVED_IDS,
  deriveNumbers,
  overriddenIds,
  type DerivedNumber,
  type DerivedNumbers,
  type SheetInput,
} from "./derived";

export class Sheet {
  private readonly numbers: DerivedNumbers;

  private constructor(
    private readonly input: SheetInput,
    private readonly dexterityModifier: number,
  ) {
    this.numbers = deriveNumbers(input);
  }

  static of(state: CharacterState): Sheet {
    const equipment = Equipment.of(state);
    const sheet = CharacterBase.of(state);
    return new Sheet(
      {
        level: state.level,
        abilities: state.abilities,
        saveProficiencies: state.saveProficiencies,
        skills: state.skills,
        overrides: state.overrides,
        miscBonuses: state.miscBonuses,
        bonuses: equipment.bonuses,
        armorClassBase: equipment.armorClassBase,
      },
      sheet.modifier("dexterity"),
    );
  }

  get proficiencyBonus(): number {
    return this.numbers.proficiencyBonus;
  }

  get spellSaveDc(): number {
    return this.numbers.spellSaveDc;
  }

  get spellAttackModifier(): number {
    return this.numbers.spellAttackModifier;
  }

  get preparationLimit(): number {
    return this.numbers.preparedLimit;
  }

  get initiative(): number {
    return this.numbers.initiative;
  }

  get passivePerception(): number {
    return this.numbers.passivePerception;
  }

  /** Слагаемые КД без учёта эффектов: их вклады прибавляет итоговый расчёт. */
  get armorClassParts(): {
    base: number;
    dexterityModifier: number;
    itemBonus: number;
    miscBonus: number;
  } {
    return {
      base: this.input.armorClassBase,
      dexterityModifier: this.dexterityModifier,
      itemBonus: this.input.bonuses.armorClass,
      miscBonus: this.input.miscBonuses.armorClass,
    };
  }

  savingThrow(ability: Ability): number {
    return this.numbers.saves[ability];
  }

  skill(id: SkillId): number {
    return this.numbers.skills[id];
  }

  /** Перечень для экрана: числа и признак «введено руками». Подписи — дело интерфейса. */
  derived(): DerivedNumber[] {
    const overridden = overriddenIds(this.input);
    return DERIVED_IDS.map((id) => ({
      id,
      value: this.numbers[id],
      overridden: overridden.has(id),
    }));
  }
}
