"use client";

import { useState } from "react";

import {
  changeLevel,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  removePermanentContribution,
  setPermanentContribution,
} from "@/core/application/useCases/sheet";
import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { AbilitySheet } from "@/ui/features/edit-character-sheet/ui/AbilitySheet";
import { CharacterSheet } from "@/ui/widgets/character-sheet/ui/CharacterSheet";
import type { SheetEdit } from "@/ui/widgets/character-sheet/model/rows";
import { HealthSheet } from "@/ui/features/edit-character-sheet/ui/HealthSheet";
import { IdentitySheet } from "@/ui/features/edit-character-sheet/ui/IdentitySheet";
import { LevelSheet } from "@/ui/features/edit-character-sheet/ui/LevelSheet";
import { MarksSheet } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { PermanentContributionSheet } from "@/ui/features/edit-character-sheet/ui/PermanentContributionSheet";
import type { Session } from "@/core/application/session";
import { applyEdit } from "@/ui/shared/model/editing";

export function SheetScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [open, setOpen] = useState<SheetEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const { character } = session;

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const save = (operation: (current: Session) => Session, close: () => void): void => {
    const reason = applyEdit(sessionStore, operation);
    setRefusal(reason);
    if (reason === null) close();
  };

  const openSheet = (edit: SheetEdit | null): void => {
    setRefusal(null);
    setOpen(edit);
  };

  const closeSheet = (): void => {
    setRefusal(null);
    setOpen(null);
  };

  const editedAbility = open?.block === "ability" ? open.ability : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <CharacterSheet character={character} onEdit={openSheet} />

      {open?.block === "identity" ? (
        <IdentitySheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(patch) => save((current) => editIdentity(current, patch), closeSheet)}
        />
      ) : null}

      {open?.block === "level" ? (
        <LevelSheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(next) => save((current) => changeLevel(current, next, clock), closeSheet)}
        />
      ) : null}

      {editedAbility === null ? null : (
        <AbilitySheet
          key={editedAbility}
          ability={editedAbility}
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(change) => save((current) => editAbility(current, change, clock), closeSheet)}
        />
      )}

      {open?.block === "health" ? (
        <HealthSheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(change) => save((current) => editHealth(current, change, clock), closeSheet)}
        />
      ) : null}

      {open?.block === "marks" ? (
        <MarksSheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(marks) => save((current) => editMarks(current, marks, clock), closeSheet)}
        />
      ) : null}

      {open?.block === "permanent" ? (
        <PermanentContributionSheet
          character={character}
          error={refusal}
          onCancel={closeSheet}
          onSave={(permanent) =>
            save((current) => setPermanentContribution(current, permanent, clock), closeSheet)
          }
          onRemove={(nameRu) =>
            save((current) => removePermanentContribution(current, nameRu, clock), closeSheet)
          }
        />
      ) : null}
    </div>
  );
}
