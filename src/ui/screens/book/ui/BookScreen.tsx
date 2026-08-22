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
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

/** Почему в бою нет ни одной кнопки подготовки: счёт без этой строки обещает то, чего на экране нет. */
const PREPARATION_OUT_OF_FIGHT = "Подготовку меняют вне боя";

export function BookScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const error = useSession((state) => state.error);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [preparationRefusal, setPreparationRefusal] = useState<string | null>(null);

  /**
   * Поиск — способ дойти до строки, а не отбор: закрываясь, он отпускает список целиком. Иначе
   * набранное слово продолжало бы прятать книгу, а поля, которое это объясняет, на экране уже нет.
   */
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
  // Строка того заклинания, которое набирают в мастере: способы, цена и вердикт приезжают ею.
  const castRow = snapshot.spells.find((candidate) => candidate.id === draft?.spellId) ?? null;

  /*
   * Отказ подготовки читается у счётчика, а не общей полосой: полоса стоит у верхнего края, кнопка
   * — в строке списка, и один отказ, названный в двух местах, читается как два разных.
   */
  const togglePreparation = async (spellId: string): Promise<void> => {
    const failure = await execute({ kind: "toggle_preparation", spellId });
    setPreparationRefusal(failure);
    if (failure !== null) sessionStore.getState().dismissError();
  };

  const inMode = spellsForScreen(snapshot.spells, "book");
  const shown = filterSpells(inMode, filters);
  const dividing = dividingCategories(inMode);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      onOpen={() => openSpell(spell.id)}
      onTogglePrepared={!inFight ? () => void togglePreparation(spell.id) : undefined}
    />
  ));
  if (bloodShown) {
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "book"), 0, (
      <BloodMagicRow
        key="blood-magic"
        bloodMagic={snapshot.bloodMagic}
        casting={casting}
        resources={snapshot.resources}
        onOpen={() => {
          closeSearch();
          setBloodOpen(true);
        }}
      />
    ));
  }
  const listLabel = spellListLabel(bloodShown);
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
          onClose={() => setOpenSpellId(null)}
        />
      )}

      {bloodOpen ? (
        <BloodMagicWizard
          bloodMagic={snapshot.bloodMagic}
          hitPoints={snapshot.sheet.hitPoints}
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
