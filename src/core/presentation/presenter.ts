/**
 * Презентер: состояние ядра — в снимок договора.
 *
 * Наружу уходит показанное, а не хранимое. Снимок отмены остаётся внутри: он состоит из полей
 * состояния, а устройство состояния — дело ядра; отменять умеет оно само, читающей стороне довольно
 * знать, что запись есть и как она называется.
 */

import type { Snapshot } from "@/contract/snapshot";

import type { LiveSession } from "@/core/application/session";

import { toBagView } from "./views/bagView";
import { toResourcesView } from "./views/resourcesView";
import { toSheetView } from "./views/sheetView";
import { toCastingView, toSpellRowViews, toTurnView } from "./views/spellRowsView";

export function toSnapshot(live: LiveSession, version: number): Snapshot {
  return {
    version,
    sheet: toSheetView(live.session.character),
    bag: toBagView(live.session.character),
    resources: toResourcesView(live.session.character),
    turn: toTurnView(live),
    casting: toCastingView(live.session.character),
    spells: toSpellRowViews(live),
    journal: live.session.journal.map((entry) => ({
      id: entry.id,
      at: entry.at,
      kind: entry.kind,
      summaryRu: entry.summaryRu,
      ...(entry.spellId === undefined ? {} : { spellId: entry.spellId }),
      ...(entry.slotLevel === undefined ? {} : { slotLevel: entry.slotLevel }),
    })),
  };
}
