import type { CharacterFields } from "./schema";

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
