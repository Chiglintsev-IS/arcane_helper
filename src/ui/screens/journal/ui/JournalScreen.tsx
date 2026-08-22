"use client";

import { useState } from "react";

import type { PreviewOf } from "@/contract/questions";

import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { usePreview } from "@/ui/shared/model/usePreview";

import { DataSheet } from "@/ui/features/data-exchange/ui/DataSheet";
import { Journal } from "@/ui/widgets/journal/ui/Journal";

export function JournalScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;

  const [dataOpen, setDataOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const execute = sessionStore.getState().execute;

  // Выгрузку собирает ядро: в ней стоит время, и своя копия сборки разошлась бы с настоящей.
  const answer = usePreview(dataOpen ? { kind: "export_preview" } : null);
  const exported: PreviewOf<"export_preview"> | null =
    answer?.kind === "export_preview" ? answer : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <Journal
        entries={snapshot.journal}
        onUndo={() => void execute({ kind: "undo_last" })}
        onData={() => setDataOpen(true)}
      />

      {dataOpen ? (
        <DataSheet
          exportText={exported?.text ?? ""}
          fileName={exported?.fileName ?? ""}
          error={importError}
          catalogSource={snapshot.catalogSource}
          onImport={async (raw) => {
            const failure = await execute({ kind: "import_snapshot", raw });
            setImportError(failure);
            if (failure === null) setDataOpen(false);
          }}
          onStartOver={() => {
            setDataOpen(false);
            void execute({ kind: "reset" });
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
