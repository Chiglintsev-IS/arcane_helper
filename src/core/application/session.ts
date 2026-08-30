import type { CharacterState } from "@/core/domain/assembly/state";
import { characterStateSchema, MUTABLE_STATE_KEYS } from "@/core/domain/assembly/state";
import type { Character } from "@/core/domain/assembly/character";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { Log } from "@/core/domain/log/log";
import type { LogEntry, Recorded } from "@/core/domain/log/entry";
import type { Clock } from "@/core/application/ports/clock";

export type Session = {
  character: CharacterState;
  log: readonly LogEntry<CharacterState>[];
};

type SpellCatalogSource = "built_in" | "imported";

export type LiveSession = {
  session: Session;
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
};

function characterLog(entries: readonly LogEntry<CharacterState>[]) {
  return Log.of(entries, MUTABLE_STATE_KEYS);
}

export type Occasion = Clock & { commandId: string };

export function alreadyApplied(session: Session, commandId: string): boolean {
  return session.log.some((entry) => entry.commandId === commandId);
}

export function createSession(character: CharacterState): Session {
  return { character, log: [] };
}

export function commit(
  session: Session,
  after: Character,
  recorded: Recorded,
  occasion: Occasion,
): Session {
  const character = after.toState();
  const log = characterLog(session.log).append(session.character, character, recorded, {
    id: occasion.nextId(),
    at: occasion.now(),
    commandId: occasion.commandId,
  });
  return { character, log: [...log.list] };
}

export function withoutRecord(session: Session, character: Character): Session {
  return { character: character.toState(), log: session.log };
}

export function undoLast(session: Session): Session {
  const { state, log } = characterLog(session.log).undoLast(session.character);
  const restored = characterStateSchema.safeParse(state);
  if (!restored.success) {
    const reasons = restored.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new DomainError(`Снимок отмены не складывается в состояние персонажа — ${reasons}`);
  }
  return { character: restored.data, log: [...log.list] };
}

export function replaceCharacter(character: CharacterState): Session {
  return createSession(character);
}
