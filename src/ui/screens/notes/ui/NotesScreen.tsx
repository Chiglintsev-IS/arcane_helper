"use client";

import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { WorldNotes } from "@/ui/widgets/world-notes/ui/WorldNotes";

export function NotesScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;

  const execute = sessionStore.getState().execute;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <WorldNotes
        notes={snapshot.notes}
        onAdd={(text) => void execute({ kind: "add_world_note", text })}
        onEdit={(noteId, text) => void execute({ kind: "edit_world_note", noteId, text })}
        onRemove={(noteId) => void execute({ kind: "remove_world_note", noteId })}
      />
    </div>
  );
}
