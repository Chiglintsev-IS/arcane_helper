import { render, type RenderResult, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach } from "vitest";

import { createClient } from "@/contract/client";
import type { Snapshot } from "@/contract/snapshot";
import type { SpellRowView } from "@/contract/views";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import type { Clock } from "@/core/application/ports/clock";
import type { SessionRepository } from "@/core/application/ports/sessionRepository";
import type { Command } from "@/contract/commands";
import { createSession, type LiveSession } from "@/core/application/session";
import { applyCommand } from "@/core/presentation/controller";
import { createLocalTransport } from "@/core/presentation/localTransport";
import { toSnapshot } from "@/core/presentation/presenter";
import { createCore } from "@/core/composition";
import { connectStores, StoreProvider } from "@/ui/app/providers/stores";
import type { AppStores } from "@/ui/shared/model/storeContext";

afterEach(cleanup);
afterEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

export function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

export const testSpells = loadThorneSpells();

export function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 6, 31, 18, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

export type PlaySituation = { inFight?: boolean; catalog?: readonly Spell[] };

export function testSnapshot(
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): Snapshot {
  const clock = testClock();
  const builtInCatalog = loadThorneSpells();
  let live: LiveSession = {
    session: createSession(character),
    spellCatalog: builtInCatalog,
    spellCatalogSource: "built_in",
  };

  commands.forEach((command, index) => {
    live = applyCommand(live, command, { ...clock, commandId: `command-${index}` }, {
      builtInCatalog,
      createInitialCharacter: () => character,
    });
  });

  return toSnapshot(live, commands.length);
}

export const IN_FIGHT: readonly Command[] = [{ kind: "start_combat" }];

export function testSpellRows(
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): SpellRowView[] {
  return testSnapshot(character, commands).spells;
}

export function testSpellRow(
  id: string,
  character: CharacterState = createThorne(),
  commands: readonly Command[] = [],
): SpellRowView {
  const found = testSpellRows(character, commands).find((row) => row.id === id);
  if (found === undefined) throw new Error(`нет строки ${id}`);
  return found;
}

export async function createTestStores(
  character: CharacterState = createThorne(),
  situation: PlaySituation = {},
): Promise<AppStores> {
  const clock = testClock();
  const core = createCore({
    repository: createMemoryRepository(),
    clock,
    createInitialCharacter: () => character,
    loadBuiltInCatalog: () => [...(situation.catalog ?? loadThorneSpells())],
  });
  const stores = connectStores(createClient(createLocalTransport(core)), clock.nextId);
  await stores.session.getState().hydrate();
  if (situation.inFight === true) {
    await stores.session.getState().execute({ kind: "start_combat" });
  }
  return stores;
}

export function shown(stores: AppStores): Snapshot {
  const { snapshot } = stores.session.getState();
  if (snapshot === null) throw new Error("сессия ещё не открыта");
  return snapshot;
}

export function slotsLeft(stores: AppStores, level: number): number {
  return shown(stores).resources.slots.find((slot) => slot.level === level)?.remaining ?? 0;
}

export async function storesOver(repository: SessionRepository): Promise<AppStores> {
  const clock = testClock();
  const core = createCore({
    repository,
    clock,
    createInitialCharacter: createThorne,
    loadBuiltInCatalog: loadThorneSpells,
  });
  const stores = connectStores(createClient(createLocalTransport(core)), clock.nextId);
  await stores.session.getState().hydrate();
  return stores;
}

export function renderOn(stores: AppStores, ui: ReactElement): RenderWithStores {
  return { ...render(<StoreProvider stores={stores}>{ui}</StoreProvider>), stores };
}

export async function createStoresOverUnreadableSave(): Promise<AppStores> {
  return storesOver(createMemoryRepository({ schemaVersion: 1, savedAt: "", character: {} }));
}

export async function createStoresOverBrokenStorage(): Promise<AppStores> {
  const unavailable = async (): Promise<never> => {
    throw new Error("Хранилище недоступно");
  };
  return storesOver({
    load: unavailable,
    loadRaw: unavailable,
    save: unavailable,
    clear: unavailable,
  });
}

export type RenderWithStores = RenderResult & { stores: AppStores };

export async function renderWithStores(
  ui: ReactElement,
  character?: CharacterState,
  situation: PlaySituation = {},
): Promise<RenderWithStores> {
  return renderOn(await createTestStores(character ?? createThorne(), situation), ui);
}
