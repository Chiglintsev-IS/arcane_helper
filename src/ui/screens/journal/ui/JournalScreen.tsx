"use client";

import { useState } from "react";

import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { exportFileName, exportSnapshot, parseImport } from "@/core/application/dataExchange";
import { undoLast } from "@/core/application/session";

import { DataSheet } from "@/ui/features/data-exchange/ui/DataSheet";
import { JournalScreen as JournalWidget } from "@/ui/widgets/journal/ui/JournalScreen";

export function JournalScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const spells = useSession((state) => state.spellCatalog);
  const catalogSource = useSession((state) => state.spellCatalogSource);

  const [dataOpen, setDataOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <JournalWidget
        entries={session.journal}
        onUndo={() => apply(undoLast)}
        onData={() => setDataOpen(true)}
      />

      {dataOpen ? (
        <DataSheet
          exportText={JSON.stringify(exportSnapshot(character, spells, clock.now()), null, 2)}
          fileName={exportFileName(clock.now())}
          error={importError}
          catalogSource={catalogSource}
          onImport={(raw) => {
            const outcome = parseImport(raw);
            if (!outcome.ok) {
              setImportError(outcome.reasonRu);
              return;
            }
            const failure = sessionStore.getState().importSnapshot(outcome.file);
            setImportError(failure);
            if (failure === null) setDataOpen(false);
          }}
          onRestoreBuiltInCatalog={() => {
            setImportError(sessionStore.getState().restoreBuiltInCatalog());
          }}
          onClose={() => {
            setImportError(null);
            setDataOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
