import type { Envelope } from "@/contract/commands";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { checkIntegrity } from "@/core/application/dataExchange";
import type { Clock } from "@/core/application/ports/clock";
import { createSession, type LiveSession, type Occasion } from "@/core/application/session";
import {
  fromPersisted,
  toPersisted,
  type SessionRepository,
} from "@/core/application/ports/sessionRepository";
import { applyCommand, startsOver } from "@/core/presentation/controller";
import { createHandler, type Backend } from "@/core/presentation/handler";

type CoreParts = {
  repository: SessionRepository;
  clock: Clock;
  createInitialCharacter: () => CharacterState;
  loadBuiltInCatalog: () => Spell[];
};

export type Core = Backend;

export function createCore(parts: CoreParts): Core {
  const { repository, clock, createInitialCharacter, loadBuiltInCatalog } = parts;
  const builtInCatalog: readonly Spell[] = loadBuiltInCatalog();

  let live: LiveSession | null = null;
  let version = 0;

  const fresh = (): LiveSession => ({
    session: createSession(createInitialCharacter()),
    spellCatalog: builtInCatalog,
    spellCatalogSource: "built_in",
  });

  const persist = async (next: LiveSession): Promise<void> => {
    const stored = next.spellCatalogSource === "imported" ? next.spellCatalog : null;
    try {
      await repository.save(toPersisted(next.session, clock.now(), stored));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Не удалось сохранить состояние: ${reason}`);
    }
  };

  const builtInIds = new Set(builtInCatalog.map((spell) => spell.id));
  const withinBuiltIn = (character: CharacterState): CharacterState =>
    Character.of(character)
      .withSpellbook(Character.of(character).spellbook.withinCatalog(builtInIds))
      .toState();

  const opened = async (): Promise<LiveSession> => {
    if (live !== null) return live;

    const stored = await repository.load();
    if (stored === null) {
      const started = fresh();
      await persist(started);
      live = started;
      return started;
    }

    const catalog = stored.spellCatalog;
    const session = fromPersisted(stored);
    const restored: LiveSession = {
      session: catalog === undefined ? { ...session, character: withinBuiltIn(session.character) } : session,
      spellCatalog: catalog ?? builtInCatalog,
      spellCatalogSource: catalog === undefined ? "built_in" : "imported",
    };
    live = restored;
    return restored;
  };

  const handler = createHandler({
    now: clock.now,

    async open() {
      return { live: await opened(), version };
    },

    async readStored() {
      return repository.loadRaw();
    },

    async execute(envelope: Envelope) {
      const current = startsOver(envelope.command) ? (live ?? fresh()) : await opened();
      const occasion: Occasion = { ...clock, commandId: envelope.commandId };
      const next = applyCommand(current, envelope.command, occasion, {
        builtInCatalog,
        createInitialCharacter,
      });

      if (next === current) return { live: current, version };

      const broken = checkIntegrity(next.session.character, next.spellCatalog);
      if (broken !== null) throw new DomainError(broken);

      await persist(next);
      live = next;
      version += 1;
      return { live: next, version };
    },
  });

  return handler;
}
