import { Character } from "@/core/domain/assembly/character";
import { withoutRecord, type Occasion, type Session } from "@/core/application/session";

export function addWorldNote(session: Session, text: string, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const written = root.notes.add({ id: occasion.nextId(), at: occasion.now(), text });
  return withoutRecord(session, root.withNotes(written));
}

export function editWorldNote(session: Session, noteId: string, text: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withNotes(root.notes.edit(noteId, text)));
}

export function removeWorldNote(session: Session, noteId: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withNotes(root.notes.remove(noteId)));
}
