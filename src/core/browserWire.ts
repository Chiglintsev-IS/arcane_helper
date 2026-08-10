/**
 * Ядро в браузере и провод до него в процессе.
 *
 * Собрано отдельным модулем, а не в композиционном корне отображения, ради одной вещи: корень
 * дотягивается сюда динамическим импортом, и сборка, выбравшая сеть, выбрасывает ядро целиком.
 * Статический импорт возил бы логику в бандле, к которой сетевая сборка не обращается ни разу.
 *
 * Провод отдаётся собранным по той же причине: он тоже часть ядра, и оставить его снаружи значило
 * бы оставить в сетевом бандле кусок логики.
 */

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
