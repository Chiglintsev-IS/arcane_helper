/**
 * Лист персонажа: то, что домены читают, но не меняют.
 *
 * Уровень нужен и ячейкам, и крови, и рунам; характеристика — проверке концентрации и лечению
 * Костями хитов. Общее ядро честнее, чем копия уровня в каждом агрегате.
 */

import type { CharacterState } from "./state";
import { abilityModifier, preparedLimit } from "./abilities";

export class CharacterSheet {
  private constructor(private readonly state: CharacterState) {}

  static of(state: CharacterState): CharacterSheet {
    return new CharacterSheet(state);
  }

  get level(): number {
    return this.state.level;
  }

  get spellcastingModifier(): number {
    return abilityModifier(this.state.intelligence);
  }

  get preparationLimit(): number {
    return preparedLimit(this.state.intelligence, this.state.level);
  }
}
