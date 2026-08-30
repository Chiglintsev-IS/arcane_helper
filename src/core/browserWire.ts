import type { Transport } from "@/contract/transport";

import { createCore } from "@/core/composition";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { systemClock } from "@/core/infrastructure/clock";
import { createDexieRepository } from "@/core/infrastructure/persistence/dexieRepository";
import { createLocalTransport } from "@/core/presentation/localTransport";

export function createBrowserWire(): Transport {
  return createLocalTransport(
    createCore({
      repository: createDexieRepository(),
      clock: systemClock(),
      createInitialCharacter: createThorne,
      loadBuiltInCatalog: loadThorneSpells,
    }),
  );
}
