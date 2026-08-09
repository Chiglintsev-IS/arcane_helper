"use client";

import { useState } from "react";

import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { exportFileName, exportSnapshot, parseImport } from "@/core/application/dataExchange";

import { DataSheet } from "@/ui/features/data-exchange/ui/DataSheet";
import { Journal } from "@/ui/widgets/journal/ui/Journal";

export function JournalScreen() {
  const { now, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const spells = useSession((state) => state.spellCatalog);
  const catalogSource = useSession((state) => state.spellCatalogSource);

  const [dataOpen, setDataOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { character } = session;
  const execute = sessionStore.getState().execute;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Journal
        entries={session.journal}
        onUndo={() => void execute({ kind: "undo_last" })}
        onData={() => setDataOpen(true)}
      />

      {dataOpen ? (
        <DataSheet
          exportText={JSON.stringify(exportSnapshot(character, spells, now()), null, 2)}
          fileName={exportFileName(now())}
          error={importError}
          catalogSource={catalogSource}
          onImport={async (raw) => {
            const outcome = parseImport(raw);
            if (!outcome.ok) {
              setImportError(outcome.reasonRu);
              return;
            }
            const failure = await execute({ kind: "import_snapshot", file: outcome.file });
            setImportError(failure);
            if (failure === null) setDataOpen(false);
          }}
          onRestoreBuiltInCatalog={async () => {
            setImportError(await execute({ kind: "restore_built_in_catalog" }));
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
