"use client";

import { useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { AbilitySheet } from "@/ui/features/edit-character-sheet/ui/AbilitySheet";
import { CharacterSheet } from "@/ui/widgets/character-sheet/ui/CharacterSheet";
import type { SheetEdit } from "@/ui/widgets/character-sheet/model/rows";
import { IdentitySheet } from "@/ui/features/edit-character-sheet/ui/IdentitySheet";
import { LevelSheet } from "@/ui/features/edit-character-sheet/ui/LevelSheet";
import { MarksSheet } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { PermanentContributionSheet } from "@/ui/features/edit-character-sheet/ui/PermanentContributionSheet";
import { applyEdit } from "@/ui/shared/model/editing";

export function SheetScreen() {
  const { session: sessionStore } = useStores();
  const { sheet, choices } = useSession((state) => state.snapshot)!;

  const [open, setOpen] = useState<SheetEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const save = async (command: Command, close: () => void): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
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
      <CharacterSheet sheet={sheet} stats={choices.stats} onEdit={openSheet} />

      {open?.block === "identity" ? (
        <IdentitySheet
          sheet={sheet}
          choices={choices}
          error={refusal}
          onCancel={closeSheet}
          onSave={(patch) => void save({ kind: "edit_identity", patch }, closeSheet)}
        />
      ) : null}

      {open?.block === "level" ? (
        <LevelSheet
          level={sheet.level}
          hitPoints={sheet.hitPoints}
          choices={choices}
          error={refusal}
          onCancel={closeSheet}
          onSave={(next) => void save({ kind: "change_level", ...next }, closeSheet)}
        />
      ) : null}

      {editedAbility === null ? null : (
        <AbilitySheet
          key={editedAbility.id}
          ability={editedAbility}
          choices={choices}
          error={refusal}
          onCancel={closeSheet}
          onSave={(change) => void save({ kind: "edit_ability", ...change }, closeSheet)}
        />
      )}

      {open?.block === "marks" ? (
        <MarksSheet
          marks={sheet}
          choices={choices}
          error={refusal}
          onCancel={closeSheet}
          onSave={(marks) => void save({ kind: "edit_marks", ...marks }, closeSheet)}
        />
      ) : null}

      {open?.block === "permanent" ? (
        <PermanentContributionSheet
          contributions={sheet.permanentContributions}
          choices={choices}
          error={refusal}
          onCancel={closeSheet}
          onSave={(permanent) =>
            void save({ kind: "set_permanent_contribution", permanent }, closeSheet)
          }
          onRemove={(nameRu) =>
            void save({ kind: "remove_permanent_contribution", nameRu }, closeSheet)
          }
        />
      ) : null}
    </div>
  );
}
