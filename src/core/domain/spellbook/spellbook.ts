import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import type { SpellbookState } from "./schema";

export class Spellbook {
  private constructor(private readonly state: SpellbookState) {}

  private static readonly KEYS = [
    "cantripIds",
    "spellbookSpellIds",
    "preparedSpellIds",
    "spellNotes",
  ] as const satisfies readonly (keyof SpellbookState)[];

  static of(state: SpellbookState): Spellbook {
    return new Spellbook(ownedFields(state, Spellbook.KEYS));
  }

  private with(change: Partial<SpellbookState>): Spellbook {
    return new Spellbook({ ...this.state, ...change });
  }

  knows(spellId: string, level: number): boolean {
    return level === CANTRIP_LEVEL
      ? this.state.cantripIds.includes(spellId)
      : this.state.spellbookSpellIds.includes(spellId);
  }

  isPrepared(spellId: string): boolean {
    return this.state.preparedSpellIds.includes(spellId);
  }

  togglePreparation(
    spellId: string,
    spellNameRu: string,
    level: number,
    limit: number,
  ): { spellbook: Spellbook; prepared: boolean } {
    if (level === CANTRIP_LEVEL) {
      throw new DomainError("Заговор не готовится: он доступен всегда");
    }
    if (!this.state.spellbookSpellIds.includes(spellId)) {
      throw new DomainError(`«${spellNameRu}» нет в книге заклинаний`);
    }

    const wasPrepared = this.isPrepared(spellId);
    if (!wasPrepared && this.state.preparedSpellIds.length >= limit) {
      throw new DomainError("Снимите другое заклинание");
    }

    return {
      spellbook: this.with({
        preparedSpellIds: wasPrepared
          ? this.state.preparedSpellIds.filter((id) => id !== spellId)
          : [...this.state.preparedSpellIds, spellId],
      }),
      prepared: !wasPrepared,
    };
  }

  withinCatalog(knownIds: ReadonlySet<string>): Spellbook {
    const known = (ids: readonly string[]) => ids.filter((id) => knownIds.has(id));
    return this.with({
      cantripIds: known(this.state.cantripIds),
      spellbookSpellIds: known(this.state.spellbookSpellIds),
      preparedSpellIds: known(this.state.preparedSpellIds),
    });
  }

  setNote(spellId: string, note: string): Spellbook {
    const { [spellId]: _replaced, ...rest } = this.state.spellNotes;
    return this.with({ spellNotes: note.trim() === "" ? rest : { ...rest, [spellId]: note } });
  }

  toState(): SpellbookState {
    return this.state;
  }
}
