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
import { CharacterBase } from "@/core/domain/character/base";

/**
 * Поля, которые правятся с «Листа»: кто персонаж сам по себе и отметки на нём. Ресурсы, здоровье,
 * книга, вещи и эффекты сюда не входят — у каждого свой агрегат со своими правилами.
 */
type SheetField =
  | "name"
  | "species"
  | "subclass"
  | "className"
  | "age"
  | "size"
  | "speed"
  | "proficiencies"
  | "abilities"
  | "saveProficiencies"
  | "skills"
  | "overrides"
  | "miscBonuses"
  | "exhaustion"
  | "inspiration"
  | "level";

export class Character {
  private constructor(private readonly state: CharacterState) {}

  static of(state: CharacterState): Character {
    return new Character(state);
  }

  /** База персонажа. Итоговые числа складывает лист — он знает и про снаряжение. */
  get base(): CharacterBase {
    return CharacterBase.of(this.state);
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

  /**
   * Правка листа персонажа: то, что за столом меняют руками, а не тратят.
   *
   * Список полей явный и узкий. Разрешив здесь любое поле состояния, корень отдал бы наружу и
   * ячейки, и эффекты — мимо агрегатов, которые их стерегут, а значит мимо их инвариантов.
   */
  withSheet(change: Partial<Pick<CharacterState, SheetField>>): Character {
    return new Character({ ...this.state, ...change });
  }

  toState(): CharacterState {
    return this.state;
  }
}
