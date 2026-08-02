/**
 * Персонаж — база: кто он сам по себе, без вещей, без заклинаний и без вмешательства мастера.
 *
 * Здесь только то, что принадлежит телу и опыту: уровень, характеристики, бонус мастерства, лимит
 * подготовки по формуле класса. Числа, в которые вмешивается снаряжение, — КС, атака, спасброски,
 * Класс Доспеха — складывает лист: контекст персонажа про вещи не знает и потому остаётся листом
 * графа зависимостей.
 */

import { abilityModifier, preparedLimit, proficiencyBonus } from "./abilities";
import { SPELLCASTING_ABILITY } from "./spellcasting";
import type { Ability } from "./skills";
import type { CharacterState } from "./state";

export class CharacterBase {
  private constructor(private readonly state: CharacterState) {}

  static of(state: CharacterState): CharacterBase {
    return new CharacterBase(state);
  }

  get level(): number {
    return this.state.level;
  }

  get proficiencyBonus(): number {
    return proficiencyBonus(this.state.level);
  }

  get spellcastingModifier(): number {
    return abilityModifier(this.state.abilities[SPELLCASTING_ABILITY]);
  }

  /** Лимит по формуле класса. Введённое руками значение перекрывает его в контексте итогов. */
  get preparationLimit(): number {
    return preparedLimit(this.state.abilities[SPELLCASTING_ABILITY], this.state.level);
  }

  modifier(ability: Ability): number {
    return abilityModifier(this.state.abilities[ability]);
  }
}
