"use client";

import { useState } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import { toCastRequest, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";
import { castSpell } from "@/core/application/useCases/casting";
import { setSpellNote, togglePreparation } from "@/core/application/useCases/library";
import { Sheet } from "@/core/domain/sheet/sheet";
import { exchangeBlood } from "@/core/application/useCases/health";

import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";
import { BloodMagicWizard } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { spellListLabel, unavailabilityReason } from "@/ui/shared/lib/spellLabels";

export function BookScreen() {
  const { clock, draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const error = useSession((state) => state.error);
  const spells = useSession((state) => state.spellCatalog);
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);

  const { character } = session;
  const apply = sessionStore.getState().apply;
  const economy = deriveTurnEconomy(session);
  const context = { character, turn: economy };
  const { inFight } = economy;
  const limit = Sheet.of(character).preparationLimit;

  const inMode = spellsForScreen(spells, character, "book", inFight);
  const shown = filterSpells(inMode, filters, context);
  const dividing = dividingCategories(inMode, inFight);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      character={character}
      unavailableReason={unavailabilityReason(spell, character, economy)}
      onOpen={() => setOpenSpellId(spell.id)}
      onTogglePrepared={
        !inFight
          ? () => apply((current) => togglePreparation(current, spell, clock))
          : undefined
      }
    />
  ));
  if (bloodShown) {
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "book", inFight), 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        economy={economy}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  const listLabel = spellListLabel(bloodShown);

  const confirm = (confirmed: CastDraft): void => {
    const failure = apply((current) => castSpell(current, toCastRequest(confirmed), clock));
    if (failure === null) {
      draftStore.getState().cancel();
      setOpenSpellId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2">
        <p
          aria-label={`Подготовлено ${character.preparedSpellIds.length} из ${limit}`}
          className={`flex-1 text-xs tabular-nums ${
            character.preparedSpellIds.length >= limit
              ? "font-medium text-reaction-strong dark:text-reaction"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {character.preparedSpellIds.length} из {limit}
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

      {openSpell === null || draft !== null ? null : (
        <SpellCardDetails
          spell={openSpell}
          character={character}
          economy={economy}
          note={character.spellNotes[openSpell.id]}
          onCast={() => draftStore.getState().start(openSpell, context)}
          onNoteChange={(note) => apply((current) => setSpellNote(current, openSpell.id, note))}
          onClose={() => setOpenSpellId(null)}
        />
      )}

      {bloodOpen ? (
        <BloodMagicWizard
          character={character}
          economy={economy}
          error={error}
          onCancel={() => setBloodOpen(false)}
          onConfirm={(points, allowAnyway) => {
            const failure = apply((current) =>
              exchangeBlood(current, points, clock, { allowAnyway }),
            );
            if (failure === null) setBloodOpen(false);
          }}
        />
      ) : null}

      <CastWizard character={character} economy={economy} onConfirm={confirm} error={error} />
    </div>
  );
}
