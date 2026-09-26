"use client";

import { useId, useState } from "react";

import type { Command } from "@/contract/commands";
import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { AbilityLedger } from "@/ui/widgets/character-sheet/ui/AbilityLedger";
import { CharacterSheet } from "@/ui/widgets/character-sheet/ui/CharacterSheet";
import { applyEdit } from "@/ui/shared/model/editing";
import type { WriteAnswer } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CHOSEN, SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const TABS = [
  { id: "rolls", labelRu: "Броски" },
  { id: "identity", labelRu: "Кто он" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function SheetScreen() {
  const { session: sessionStore } = useStores();
  const { sheet, choices } = useSession((state) => state.snapshot)!;

  const [tab, setTab] = useState<Tab>("rolls");
  const panelId = useId();

  const write = (command: Command): WriteAnswer => applyEdit(sessionStore, command);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <AbilityLedger
            sheet={sheet}
            choices={choices}
            onWriteAbility={(change) => write({ kind: "edit_ability", ...change })}
          />
        ) : (
          <CharacterSheet
            sheet={sheet}
            choices={choices}
            onWriteIdentity={(patch) => write({ kind: "edit_identity", patch })}
            onWriteLevel={(next) => write({ kind: "change_level", ...next })}
          />
        )}
      </div>
    </div>
  );
}
