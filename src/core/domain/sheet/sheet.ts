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
import type { CharacterFields } from "@/core/domain/character/schema";
import { Equipment } from "@/core/domain/equipment/equipment";
import type { EquipmentData } from "@/core/domain/equipment/schema";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";
import {
  DERIVED_IDS,
  deriveNumbers,
  derivedValue,
  type DerivedNumber,
  type DerivedNumbers,
  type SheetInput,
} from "./derived";

/**
 * Что нужно листу, чтобы посчитать: поля персонажа, снаряжение и вещи, на которые оно ссылается.
 *
 * Тип структурный, а не «состояние персонажа целиком»: лист складывает базу с вещами и не обязан
 * знать ни про ячейки, ни про книгу. Полное состояние подходит сюда по форме.
 */
export type SheetSource = Pick<
  CharacterFields,
  "level" | "abilities" | "saveProficiencies" | "skills" | "overrides" | "miscBonuses"
> & { equipment: EquipmentData; itemDefinitions: readonly ItemDefinition[] };

export class Sheet {
  private readonly numbers: DerivedNumbers;

  private constructor(
    private readonly input: SheetInput,
    private readonly dexterityModifier: number,
    private readonly wornArmorNameRu: string | undefined,
  ) {
    this.numbers = deriveNumbers(input);
  }

  static of(state: SheetSource): Sheet {
    const items = Items.of(state);
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
        bonuses: equipment.bonuses(items),
        armorClassBase: equipment.armorClassBase(items),
      },
      sheet.modifier("dexterity"),
      equipment.wornArmor(items)?.nameRu,
    );
  }

  get proficiencyBonus(): number {
    return this.numbers.proficiencyBonus.value;
  }

  get spellSaveDc(): number {
    return this.numbers.spellSaveDc.value;
  }

  get spellAttackModifier(): number {
    return this.numbers.spellAttackModifier.value;
  }

  get preparationLimit(): number {
    return this.numbers.preparedLimit.value;
  }

  get initiative(): number {
    return this.numbers.initiative.value;
  }

  get passivePerception(): number {
    return this.numbers.passivePerception.value;
  }

  /**
   * Слагаемые КД без учёта эффектов: их вклады прибавляет итоговый расчёт.
   *
   * База — из надетого доспеха, если игрок не перебил её руками; признак перебивки и база по
   * надетому идут рядом с ней, иначе введённое выглядит счётом, а отступать не от чего.
   */
  get armorClassParts(): {
    base: number;
    baseOverridden: boolean;
    baseFormula: number;
    dexterityModifier: number;
    itemBonus: number;
    miscBonus: number;
    wornArmorNameRu: string | undefined;
  } {
    const base = derivedValue(this.input.overrides.armorClassBase, this.input.armorClassBase);
    return {
      base: base.value,
      baseOverridden: base.overridden,
      baseFormula: base.formula,
      dexterityModifier: this.dexterityModifier,
      itemBonus: this.input.bonuses.armorClass,
      miscBonus: this.input.miscBonuses.armorClass,
      wornArmorNameRu: this.wornArmorNameRu,
    };
  }

  savingThrow(ability: Ability): number {
    return this.numbers.saves[ability];
  }

  skill(id: SkillId): number {
    return this.numbers.skills[id];
  }

  /**
   * Перечень для экрана: действующее число, признак «введено руками» и значение по формуле.
   *
   * Подписи — дело интерфейса, но собирать вход счёта заново, чтобы узнать формулу, экрану нечем:
   * второй сборщик того же входа расходится с этим молча.
   */
  derived(): DerivedNumber[] {
    return DERIVED_IDS.map((id) => ({ id, ...this.numbers[id] }));
  }
}
