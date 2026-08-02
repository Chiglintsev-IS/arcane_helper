/**
 * Персонаж — корень, через который проходит любое изменение его состояния.
 *
 * Сам он ничего не считает: держит лист персонажа (то, что за сессию не меняется) и четыре
 * агрегата, каждый со своими правилами. Снаружи состояние правится только так — отдельные поля
 * недоступны, поэтому инвариант нельзя обойти, забыв про проверку.
 */

import { Arcana } from "@/core/domain/arcana/arcana";
import { EffectBoard } from "@/core/domain/effects/effectBoard";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Spellbook } from "@/core/domain/spellbook/spellbook";
import { Vitality } from "@/core/domain/vitality/vitality";
import type { CharacterState } from "./state";
import { CharacterSheet } from "./sheet";

export class Character {
  private constructor(private readonly state: CharacterState) {}

  static of(state: CharacterState): Character {
    return new Character(state);
  }

  get sheet(): CharacterSheet {
    return CharacterSheet.of(this.state);
  }

  get arcana(): Arcana {
    return Arcana.of(this.state);
  }

  get vitality(): Vitality {
    return Vitality.of(this.state);
  }

  get effects(): EffectBoard {
    return EffectBoard.of(this.state);
  }

  get spellbook(): Spellbook {
    return Spellbook.of(this.state);
  }

  get equipment(): Equipment {
    return Equipment.of(this.state);
  }

  withArcana(arcana: Arcana): Character {
    return new Character({ ...this.state, ...arcana.toState() });
  }

  withVitality(vitality: Vitality): Character {
    return new Character({ ...this.state, ...vitality.toState() });
  }

  withSpellbook(spellbook: Spellbook): Character {
    return new Character({ ...this.state, ...spellbook.toState() });
  }

  withEquipment(equipment: Equipment): Character {
    return new Character({ ...this.state, ...equipment.toState() });
  }

  /**
   * Концентрация необязательна, поэтому доска эффектов возвращает состояние без ключа, когда
   * концентрации нет. Расстановка `...` его бы не убрала — ключ приходится снимать явно.
   */
  withEffects(effects: EffectBoard): Character {
    const board = effects.toState();
    const { concentration: _dropped, ...rest } = this.state;
    return new Character({
      ...rest,
      activeEffects: board.activeEffects,
      ...(board.concentration === undefined ? {} : { concentration: board.concentration }),
    });
  }

  toState(): CharacterState {
    return this.state;
  }
}
