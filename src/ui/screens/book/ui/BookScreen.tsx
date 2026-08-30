"use client";

import { useState } from "react";

import { lastHintTraits } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";

import { LastHintRow } from "@/ui/features/last-hint/ui/LastHintRow";
import { LastHintSheet } from "@/ui/features/last-hint/ui/LastHintSheet";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { spellListLabel } from "@/ui/shared/lib/spellLabels";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

const PREPARATION_OUT_OF_FIGHT = "Подготовку меняют вне боя";

export function BookScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const error = useSession((state) => state.error);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [preparationRefusal, setPreparationRefusal] = useState<string | null>(null);

  const closeSearch = (): void => {
    setSearchOpen(false);
    setFilters((current) => ({ ...current, query: "" }));
  };

  const openSpell = (spellId: string): void => {
    closeSearch();
    setOpenSpellId(spellId);
  };

  const execute = sessionStore.getState().execute;
  const turn = snapshot.turn;
  const { inFight } = turn;
  const { casting } = snapshot;
  const castRow = snapshot.spells.find((candidate) => candidate.id === draft?.spellId) ?? null;

  const togglePreparation = async (spellId: string): Promise<void> => {
    const failure = await execute({ kind: "toggle_preparation", spellId });
    setPreparationRefusal(failure);
    if (failure !== null) sessionStore.getState().dismissError();
  };

  const inMode = spellsForScreen(snapshot.spells, "book");
  const shown = filterSpells(inMode, filters);
  const dividing = dividingCategories(inMode);
  const hintTraits = lastHintTraits(snapshot.resources.lastHint.nameRu);
  const hintShown = matchesActionRow(hintTraits, filters);
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      armorClass={snapshot.sheet.armorClass}
      onOpen={() => openSpell(spell.id)}
      onTogglePrepared={!inFight ? () => void togglePreparation(spell.id) : undefined}
    />
  ));
  if (hintShown) {
    rows.splice(positionInList(shown, hintTraits, "book"), 0, (
      <LastHintRow
        key="last-hint"
        resources={snapshot.resources}
        onOpen={() => {
          closeSearch();
          setHintOpen(true);
        }}
      />
    ));
  }
  const listLabel = spellListLabel(hintShown);
  const counted = `${casting.preparedCount} из ${casting.preparedLimit}`;
  const refused = !inFight && preparationRefusal !== null;
  const reason = inFight ? PREPARATION_OUT_OF_FIGHT : preparationRefusal;
  const reasonTail = reason === null ? "" : ` · ${reason}`;

  const confirm = async (confirmed: CastDraft): Promise<void> => {
    const failure = await execute(toCastCommand(confirmed));
    if (failure === null) {
      draftStore.getState().cancel();
      setOpenSpellId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-2">
        <p
          role="status"
          aria-label={`Подготовлено ${counted}${reasonTail}`}
          className="text-xs tabular-nums text-ink-quiet"
        >
          {counted}
          {reasonTail === "" ? null : (
            <span className={refused ? "font-medium text-reaction" : ""}>
              {reasonTail}
            </span>
          )}
        </p>
      </div>

      <div className={`flex shrink-0 flex-col gap-2 px-3 py-2 ${SURFACE_GROUP}`}>
        <SpellFilters
          filters={filters}
          dividing={dividing}
          mode="book"
          searchOpen={searchOpen}
          onChange={setFilters}
          onSearchToggle={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
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

      {openRow === null || draft !== null ? null : (
        <SpellCardDetails
          row={openRow}
          casting={casting}
          onCast={() => draftStore.getState().start(openRow)}
          onNoteChange={(note) => void execute({ kind: "set_spell_note", spellId: openRow.id, note })}
          onToggleMaterial={() => void execute({ kind: "toggle_material", spellId: openRow.id })}
          onClose={() => setOpenSpellId(null)}
        />
      )}

      {!hintOpen ? null : (
        <LastHintSheet
          resources={snapshot.resources}
          onAdjust={(delta) => void execute({ kind: "adjust_last_hint", delta })}
          onClose={() => setHintOpen(false)}
        />
      )}

      <CastWizard
        row={castRow}
        resources={snapshot.resources}
        choices={snapshot.choices}
        hitDice={snapshot.sheet.hitPoints.hitDice}
        onConfirm={confirm}
        error={error}
      />
    </div>
  );
}
