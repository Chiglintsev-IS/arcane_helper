/**
 * Персонаж — единственный агрегат: корень, через который проходит любое изменение состояния.
 *
 * Сам он ничего не считает: держит лист персонажа (то, что за сессию не меняется) и четыре
 * объекта-значения, каждый со своими правилами. Снаружи состояние правится только так — отдельные
 * поля недоступны, поэтому инвариант нельзя обойти, забыв про проверку.
 */

import { Arcana } from "@/core/domain/arcana/arcana";
import { Crafting } from "@/core/domain/crafting/crafting";
import { EffectBoard } from "@/core/domain/effects/effectBoard";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import { Notes } from "@/core/domain/notes/notes";
import { Sheet } from "@/core/domain/sheet/sheet";
import { Spellbook } from "@/core/domain/spellbook/spellbook";
import { Vitality } from "@/core/domain/vitality/vitality";
import type { SourcedContribution } from "@/core/domain/shared/stats";
import type { CharacterState } from "./state";
import { CharacterBase } from "@/core/domain/character/base";
import { parsedCharacterFields } from "@/core/domain/character/schema";

/**
 * Поля, которые правятся с «Листа»: кто персонаж сам по себе и отметки на нём. Ресурсы, здоровье,
 * книга, вещи и эффекты сюда не входят — у каждого свой объект-значение со своими правилами.
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

  get items(): Items {
    return Items.of(this.state);
  }

  get crafting(): Crafting {
    return Crafting.of(this.state);
  }

  get notes(): Notes {
    return Notes.of(this.state);
  }

  /**
   * Лист персонажа: основание — его собственные поля, вклады — от надетого и от действующего.
   *
   * Собирает их корень, потому что больше некому: снаряжение, эффекты и лист друг о друге не знают,
   * а знать, из чего состоит персонаж, — как раз его дело.
   */
  get sheet(): Sheet {
    return Sheet.of(this.state, this.contributions());
  }

  /**
   * Лист, каким он станет, если сотворить заклинание, — состояние при этом не меняется.
   *
   * Предпросмотр и итог считаются одним и тем же кодом: расхождение между обещанным и случившимся
   * возможно только там, где их считают дважды.
   */
  sheetWith(spell: Parameters<EffectBoard["contributionsWith"]>[0]): Sheet {
    return Sheet.of(this.state, [
      ...this.equipment.contributions(this.items),
      ...this.effects.contributionsWith(spell),
    ]);
  }

  private contributions(): readonly SourcedContribution[] {
    return [...this.equipment.contributions(this.items), ...this.effects.contributions()];
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

  withItems(items: Items): Character {
    return new Character({ ...this.state, ...items.toState() });
  }

  withCrafting(crafting: Crafting): Character {
    return new Character({ ...this.state, ...crafting.toState() });
  }

  withNotes(notes: Notes): Character {
    return new Character({ ...this.state, ...notes.toState() });
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
   * ячейки, и эффекты — мимо объектов-значений, которые их стерегут, а значит мимо их инвариантов.
   * В состояние идёт разобранный патч, а не сырой: умолчания полей обязаны попасть персонажу, а не
   * в отброшенный результат проверки.
   */
  withSheet(change: Partial<Pick<CharacterState, SheetField>>): Character {
    return new Character({ ...this.state, ...parsedCharacterFields(this.state, change) });
  }

  toState(): CharacterState {
    return this.state;
  }
}
