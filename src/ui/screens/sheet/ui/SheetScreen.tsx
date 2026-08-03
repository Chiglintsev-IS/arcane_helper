"use client";

import { useState } from "react";

import {
  changeLevel,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  editMiscBonuses,
  setArmorClassBaseOverride,
  setOverride,
} from "@/core/application/useCases/sheet";
import { deriveNumbers, type DerivedId } from "@/core/domain/sheet/derived";
import { ABILITIES } from "@/core/domain/character/skills";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Sheet } from "@/core/domain/sheet/sheet";
import { useSession, useStores } from "@/ui/shared/model/storeContext";

import { AbilitySheet } from "@/ui/features/edit-character-sheet/ui/AbilitySheet";
import { ArmorClassBaseSheet } from "@/ui/features/edit-character-sheet/ui/ArmorClassBaseSheet";
import { CharacterSheetScreen } from "@/ui/widgets/character-sheet/ui/CharacterSheetScreen";
import { HealthSheet } from "@/ui/features/edit-character-sheet/ui/HealthSheet";
import { IdentitySheet } from "@/ui/features/edit-character-sheet/ui/IdentitySheet";
import { LevelSheet } from "@/ui/features/edit-character-sheet/ui/LevelSheet";
import { MarksSheet } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { MiscBonusesSheet } from "@/ui/features/edit-character-sheet/ui/MiscBonusesSheet";
import { OverridePickerSheet } from "@/ui/features/edit-character-sheet/ui/OverridePickerSheet";
import { OverrideSheet } from "@/ui/features/edit-character-sheet/ui/OverrideSheet";

export function SheetScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;

  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [openOverrideId, setOpenOverrideId] = useState<DerivedId | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;

  const editedAbility = ABILITIES.find((ability) => openBlockId === `ability:${ability}`) ?? null;
  const derivedNumbers = Sheet.of(character).derived();
  const formulaNumbers = deriveNumbers({
    ...character,
    bonuses: Equipment.of(character).bonuses,
    armorClassBase: Equipment.of(character).armorClassBase,
    overrides: { saves: {}, skills: {} },
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <CharacterSheetScreen character={character} onEdit={setOpenBlockId} />

      {openBlockId === "identity" ? (
        <IdentitySheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(patch) => {
            if (apply((current) => editIdentity(current, patch)) === null) setOpenBlockId(null);
          }}
        />
      ) : null}

      {openBlockId === "level" ? (
        <LevelSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(next) => {
            if (apply((current) => changeLevel(current, next, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {editedAbility === null ? null : (
        <AbilitySheet
          key={editedAbility}
          ability={editedAbility}
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(change) => {
            if (apply((current) => editAbility(current, change, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      )}

      {openBlockId === "miscBonuses" ? (
        <MiscBonusesSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(miscBonuses) => {
            if (apply((current) => editMiscBonuses(current, miscBonuses, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "health" ? (
        <HealthSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(change) => {
            if (apply((current) => editHealth(current, change, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "armorClassBase" ? (
        <ArmorClassBaseSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(value) => {
            if (apply((current) => setArmorClassBaseOverride(current, value, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "marks" ? (
        <MarksSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(marks) => {
            if (apply((current) => editMarks(current, marks, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "combatNumbers" && openOverrideId === null ? (
        <OverridePickerSheet
          numbers={derivedNumbers}
          onCancel={() => setOpenBlockId(null)}
          onPick={setOpenOverrideId}
        />
      ) : null}

      {openOverrideId === null ? null : (
        <OverrideSheet
          id={openOverrideId}
          formulaValue={formulaNumbers[openOverrideId]}
          currentValue={derivedNumbers.find((number) => number.id === openOverrideId)?.value ?? 0}
          onCancel={() => setOpenOverrideId(null)}
          onSave={(value) => {
            if (apply((current) => setOverride(current, openOverrideId, value, clock)) === null) {
              setOpenOverrideId(null);
              setOpenBlockId(null);
            }
          }}
        />
      )}
    </div>
  );
}
