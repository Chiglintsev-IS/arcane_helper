/**
 * Презентер: состояние ядра — в снимок договора.
 *
 * Наружу уходит показанное, а не хранимое. Снимок отмены остаётся внутри: он состоит из полей
 * состояния, а устройство состояния — дело ядра; отменять умеет оно само, читающей стороне довольно
 * знать, что запись есть и как она называется.
 */

import type { RawSave } from "@/contract/rawSave";
import type { Snapshot } from "@/contract/snapshot";

import { rawSaveFileName } from "@/core/application/dataExchange";
import type { LiveSession } from "@/core/application/session";

import { toBagView } from "./views/bagView";
import { toBloodMagicView } from "./views/bloodMagicView";
import { toChoicesView } from "./views/choicesView";
import { toConcentrationView } from "./views/concentrationView";
import { toCraftingView } from "./views/craftingView";
import { toEffectViews } from "./views/effectsView";
import { toRecoveryView } from "./views/recoveryView";
import { toResourcesView } from "./views/resourcesView";
import { toSheetView } from "./views/sheetView";
import {
  toCastingView,
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
    bag: toBagView(live.session.character, live.spellCatalog),
    crafting: toCraftingView(live.session.character),
    resources: toResourcesView(live.session),
    recovery: toRecoveryView(live.session),
    turn: toTurnView(live),
    ...(concentration === undefined ? {} : { concentration }),
    effects: toEffectViews(live.session.character),
    casting: toCastingView(live.session.character),
    bloodMagic: toBloodMagicView(live.session),
    spells: toSpellRowViews(live),
    ...(spellsRefusalRu === undefined ? {} : { spellsRefusalRu }),
    choices: toChoicesView(),
    catalogSource: live.spellCatalogSource,
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

/**
 * Содержимое хранилища — в копию, которую забирают файлом.
 *
 * Схемой оно не разбирается ни здесь, ни дальше: сюда попадает то, что разбор уже отверг. Текст
 * собирается на этой стороне, потому что имя файла несёт дату, а часы есть только у ядра.
 */
export function toRawSave(stored: unknown, now: string): RawSave {
  if (stored === null || stored === undefined) return null;
  return { fileName: rawSaveFileName(now), text: JSON.stringify(stored, null, 2) };
}
