"use client";

import { useState } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";

import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";
import { BloodMagicWizard } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { spellListLabel } from "@/ui/shared/lib/spellLabels";

export function BookScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const error = useSession((state) => state.error);
  const spells = useSession((state) => state.spellCatalog);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);

  const { character } = session;
  const execute = sessionStore.getState().execute;
  const turn = snapshot.turn;
  const context = { character, turn };
  const { inFight } = turn;
  const { casting } = snapshot;

  const inMode = spellsForScreen(snapshot.spells, "book");
  const shown = filterSpells(inMode, filters);
  const dividing = dividingCategories(inMode);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      onOpen={() => setOpenSpellId(spell.id)}
      onTogglePrepared={
        !inFight
          ? () => void execute({ kind: "toggle_preparation", spellId: spell.id })
          : undefined
      }
    />
  ));
  if (bloodShown) {
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "book"), 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        casting={casting}
        turn={turn}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  const listLabel = spellListLabel(bloodShown);

  const confirm = async (confirmed: CastDraft): Promise<void> => {
    const failure = await execute(toCastCommand(confirmed));
    if (failure === null) {
      draftStore.getState().cancel();
      setOpenSpellId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2">
        <p
          aria-label={`Подготовлено ${casting.preparedCount} из ${casting.preparedLimit}`}
          className={`flex-1 text-xs tabular-nums ${
            casting.preparedCount >= casting.preparedLimit
              ? "font-medium text-reaction-strong dark:text-reaction"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {casting.preparedCount} из {casting.preparedLimit}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <SpellFilters
          filters={filters}
          dividing={dividing}
          mode="book"
          onChange={setFilters}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {rows.length > 0 ? (
          <ul aria-label={listLabel} className="flex flex-col gap-2">
            {rows}
          </ul>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm">Под выбранные фильтры не подходит ни одно заклинание.</p>
        ) : null}
      </div>

      {openSpell === null || openRow === null || draft !== null ? null : (
        <SpellCardDetails
          spell={openSpell}
          row={openRow}
          casting={casting}
          note={character.spellNotes[openSpell.id]}
          onCast={() => draftStore.getState().start(openSpell, context)}
          onNoteChange={(note) => void execute({ kind: "set_spell_note", spellId: openSpell.id, note })}
          onClose={() => setOpenSpellId(null)}
        />
      )}

      {bloodOpen ? (
        <BloodMagicWizard
          character={character}
          turn={turn}
          error={error}
          onCancel={() => setBloodOpen(false)}
          onConfirm={async (points, allowAnyway) => {
            const failure = await execute({
              kind: "exchange_blood",
              spellPoints: points,
              allowAnyway,
            });
            if (failure === null) setBloodOpen(false);
          }}
        />
      ) : null}

      <CastWizard
        character={character}
        casting={casting}
        turn={turn}
        onConfirm={confirm}
        error={error}
      />
    </div>
  );
}
