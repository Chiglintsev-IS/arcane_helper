import type { RawSave } from "@/contract/rawSave";
import type { Snapshot } from "@/contract/snapshot";

import { rawSaveFileName } from "@/core/application/dataExchange";
import type { LiveSession } from "@/core/application/session";

import { toBagView } from "./views/bagView";
import { toChoicesView } from "./views/choicesView";
import { toConcentrationView } from "./views/concentrationView";
import { toCraftingView } from "./views/craftingView";
import { toEffectViews } from "./views/effectsView";
import { toRecoveryView } from "./views/recoveryView";
import { toResourcesView } from "./views/resourcesView";
import { toSheetView } from "./views/sheetView";
import {
  toCastingView,
  knownSpells,
  toSpellRowViews,
  toSpellsRefusal,
  toTurnView,
} from "./views/spellRowsView";

export function toSnapshot(live: LiveSession, version: number): Snapshot {
  const concentration = toConcentrationView(live);
  const spellsRefusalRu = toSpellsRefusal(live);

  return {
    version,
    sheet: toSheetView(live.session.character),
    bag: toBagView(live.session.character, knownSpells(live)),
    crafting: toCraftingView(live.session.character),
    resources: toResourcesView(live.session),
    recovery: toRecoveryView(live.session),
    turn: toTurnView(live),
    ...(concentration === undefined ? {} : { concentration }),
    effects: toEffectViews(live.session.character),
    casting: toCastingView(live.session.character),
    spells: toSpellRowViews(live),
    ...(spellsRefusalRu === undefined ? {} : { spellsRefusalRu }),
    choices: toChoicesView(),
    catalogSource: live.spellCatalogSource,
    notes: live.session.character.worldNotes.map((note) => ({
      id: note.id,
      at: note.at,
      text: note.text,
    })),
    log: live.session.log.map((entry) => ({
      id: entry.id,
      at: entry.at,
      kind: entry.kind,
      summaryRu: entry.summaryRu,
      ...(entry.spellId === undefined ? {} : { spellId: entry.spellId }),
      ...(entry.slotLevel === undefined ? {} : { slotLevel: entry.slotLevel }),
    })),
  };
}

export function toRawSave(stored: unknown, now: string): RawSave {
  if (stored === null || stored === undefined) return null;
  return { fileName: rawSaveFileName(now), text: JSON.stringify(stored, null, 2) };
}
