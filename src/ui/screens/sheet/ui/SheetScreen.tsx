"use client";

import { useId, useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { AbilityLedger } from "@/ui/widgets/character-sheet/ui/AbilityLedger";
import { AbilitySheet } from "@/ui/features/edit-character-sheet/ui/AbilitySheet";
import { CharacterSheet } from "@/ui/widgets/character-sheet/ui/CharacterSheet";
import type { SheetEdit } from "@/ui/widgets/character-sheet/model/rows";
import { IdentitySheet } from "@/ui/features/edit-character-sheet/ui/IdentitySheet";
import { LanguagesSheet } from "@/ui/features/edit-character-sheet/ui/LanguagesSheet";
import { LevelSheet } from "@/ui/features/edit-character-sheet/ui/LevelSheet";
import { ProficienciesSheet } from "@/ui/features/edit-character-sheet/ui/ProficienciesSheet";
import { applyEdit } from "@/ui/shared/model/editing";
import { SURFACE_CHOSEN, SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/**
 * Две вкладки листа: чем бросают и кто он.
 *
 * Вопроса у стола два, и заданы они в разные минуты. «Броски» спрашивают, когда мастер попросил
 * бросить, — и ответ обязан стоять целиком, без прокрутки. «Кто он» спрашивают раз за вечер, и
 * прокрутка там ничего не стоит. Одной колонкой оба ответа занимали три экрана, и первый из них
 * приходилось искать прокруткой в ту самую секунду, которой за столом нет.
 */
const TABS = [
  { id: "rolls", labelRu: "Броски" },
  { id: "identity", labelRu: "Кто он" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function SheetScreen() {
  const { session: sessionStore } = useStores();
  const { sheet, choices } = useSession((state) => state.snapshot)!;

  /** Начинают с бросков: за столом лист открывают, чтобы назвать число, а не чтобы вспомнить вид. */
  const [tab, setTab] = useState<Tab>("rolls");
  const [open, setOpen] = useState<SheetEdit | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const panelId = useId();

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Обе вкладки видны всегда: показанная отмечена акцентом, вторая остаётся нажимаемой. */}
      <div role="tablist" className="flex shrink-0 gap-1 px-3 pt-1.5">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === tab}
            aria-controls={panelId}
            onClick={() => setTab(candidate.id)}
            className={`h-11 flex-1 text-sm ${
              candidate.id === tab ? `font-semibold ${SURFACE_CHOSEN}` : SURFACE_CONTROL
            }`}
          >
            {candidate.labelRu}
          </button>
        ))}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2.5 pt-1.5"
      >
        {tab === "rolls" ? (
          <AbilityLedger sheet={sheet} onEdit={openSheet} />
        ) : (
          <CharacterSheet sheet={sheet} onEdit={openSheet} />
        )}
      </div>

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

      {open?.block === "proficiencies" ? (
        <ProficienciesSheet
          proficiencies={sheet.proficiencies}
          error={refusal}
          onCancel={closeSheet}
          onSave={(proficiencies) =>
            void save({ kind: "edit_identity", patch: { proficiencies } }, closeSheet)
          }
        />
      ) : null}

      {open?.block === "languages" ? (
        <LanguagesSheet
          proficiencies={sheet.proficiencies}
          error={refusal}
          onCancel={closeSheet}
          onSave={(proficiencies) =>
            void save({ kind: "edit_identity", patch: { proficiencies } }, closeSheet)
          }
        />
      ) : null}
    </div>
  );
}
