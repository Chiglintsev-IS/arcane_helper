import { createCore, type Core } from "@/core/composition";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { systemClock } from "@/core/infrastructure/clock";
import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";

let core: Core | null = null;

export function serverCore(): Core {
  core ??= createCore({
    repository: createMemoryRepository(),
    clock: systemClock(),
    createInitialCharacter: createThorne,
    loadBuiltInCatalog: loadThorneSpells,
  });
  return core;
}
