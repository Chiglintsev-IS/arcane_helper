/**
 * Персонаж — база: кто он сам по себе, без вещей, без заклинаний и без вмешательства мастера.
 *
 * Здесь только то, что принадлежит телу и опыту: уровень, характеристики, бонус мастерства.
 * Числа, в которые вмешивается снаряжение или перебивка, — КС, атака, спасброски, Класс Доспеха,
 * лимит подготовки — складывает лист: контекст персонажа про вещи не знает и потому остаётся листом
 * графа зависимостей.
 */

import { abilityModifier, proficiencyBonus } from "./abilities";
import { SPELLCASTING_ABILITY } from "./spellcasting";
import type { Ability } from "./skills";
import type { CharacterFields } from "./schema";

/** База читает только своё: уровень и характеристики. Полное состояние ей подходит по форме. */
type BaseState = Pick<CharacterFields, "level" | "abilities">;

export class CharacterBase {
  private constructor(private readonly state: BaseState) {}

  static of(state: BaseState): CharacterBase {
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

  modifier(ability: Ability): number {
    return abilityModifier(this.state.abilities[ability]);
  }
}
