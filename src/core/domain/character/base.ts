/**
 * Персонаж — база: кто он сам по себе, без вещей, без заклинаний и без вмешательства мастера.
 *
 * Производных чисел здесь нет ни одного: их складывает лист единой свёрткой, и второй вычислитель
 * того же числа разошёлся бы с ним молча — спасброски здесь однажды уже не знали про назначенный
 * бонус мастерства. Осталось то, что не считается ни из чего.
 */

import type { CharacterFields } from "./schema";

/** База читает только своё. Полное состояние ей подходит по форме. */
type BaseState = Pick<CharacterFields, "level">;

export class CharacterBase {
  private constructor(private readonly state: BaseState) {}

  static of(state: BaseState): CharacterBase {
    return new CharacterBase(state);
  }

  get level(): number {
    return this.state.level;
  }
}
