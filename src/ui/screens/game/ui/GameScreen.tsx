"use client";

import { Character } from "@/core/domain/assembly/character";
import { saveStatId } from "@/core/domain/shared/stats";
import { useState, useMemo } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import type { Command } from "@/contract/commands";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";
import { wardingSigilAvailable } from "@/core/application/useCases/effects";
import { combatEndRecovery, deriveTurnEconomy } from "@/core/application/useCases/turn";
import { describeConcentrationCheck, type ConcentrationCheck } from "@/core/domain/effects/concentration";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ArmorClassSheet } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";
import { BloodMagicWizard } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { ConcentrationPanel } from "@/ui/entities/concentration/ui/ConcentrationPanel";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { ReactionsSheet } from "@/ui/features/reactions/ui/ReactionsSheet";
import { ResourceBadges, ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { ResourcesSheet } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { spellListLabel } from "@/ui/shared/lib/spellLabels";
import { applyEdit } from "@/ui/shared/model/editing";

export function GameScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const error = useSession((state) => state.error);
  const spells = useSession((state) => state.spellCatalog);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [fightOverOpen, setFightOverOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [armorClassOpen, setArmorClassOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [pendingCheck, setPendingCheck] = useState<ConcentrationCheck | null>(null);

  const { character } = session;
  const execute = sessionStore.getState().execute;
  const [refusal, setRefusal] = useState<string | null>(null);

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const saveEdit = async (command: Command, close: () => void): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
    setRefusal(reason);
    if (reason === null) close();
  };
  const economy = deriveTurnEconomy(session);
  const { inFight } = economy;
  const context = { character, turn: economy };

  const concentrationSummary = useMemo(() => {
    const effect = character.activeEffects.find((candidate) => candidate.isConcentration);
    if (effect === undefined) return null;
    return describeConcentration({
      spell: spells.find((candidate) => candidate.id === effect.spellId) ?? null,
      effect,
      character,
      casting: snapshot.casting,
      journal: session.journal,
    });
  }, [character, spells, snapshot.casting, session.journal]);

  const { casting } = snapshot;
  const inMode = spellsForScreen(snapshot.spells, "play");
  const shown = filterSpells(inMode, filters);
  const dividing = dividingCategories(inMode);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;
  // Карточки тех же строк: у реакций своей проекции ещё нет, и они читают карточку из каталога.
  const reactionSpells = spells.filter((spell) => inMode.some((row) => row.id === spell.id));

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      onOpen={() => setOpenSpellId(spell.id)}
    />
  ));
  if (bloodShown) {
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "play"), 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        casting={casting}
        economy={economy}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  const listLabel = spellListLabel(bloodShown);

  const recordDamage = async (damage: number, fire: boolean): Promise<void> => {
    if ((await execute({ kind: "take_damage", damage, fire })) !== null) return;
    setDamageOpen(false);
    setPanelOpen(false);
    if (character.concentration !== undefined) {
      setPendingCheck(
        describeConcentrationCheck(damage, Character.of(character).sheet.value(saveStatId("constitution"))),
      );
    }
  };

  const startFight = async (): Promise<void> => {
    if ((await execute({ kind: "start_combat" })) === null) setFilters(NO_FILTERS);
  };

  const finishFight = async (): Promise<void> => {
    if ((await execute({ kind: "end_combat" })) !== null) return;
    setFilters(NO_FILTERS);
    setFightOverOpen(false);
  };

  const confirm = async (confirmed: CastDraft): Promise<void> => {
    const failure = await execute(toCastCommand(confirmed));
    if (failure === null) {
      draftStore.getState().cancel();
      setOpenSpellId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * Одна область прокрутки на весь экран: закреплены только хиты и ячейки — они уезжать не
       * вправе. Всё остальное едет вместе со списком, иначе первая карточка не влезает целиком.
       */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {/*
         * Фон у закреплённой полосы обязателен: без него уезжающие значки просвечивают сквозь неё.
         * `Canvas` — системный цвет страницы, один и тот же в светлой и в тёмной теме.
         */}
        <div className="sticky top-0 z-10 bg-[Canvas] pb-1 pt-2">
          <ResourceHeader
            character={character}
            onOpenArmorClass={() => setArmorClassOpen(true)}
            onOpenHitPoints={() => setDamageOpen(true)}
            onEditResources={() => setResourcesOpen(true)}
          />
        </div>

        <ResourceBadges
          character={character}
          economy={economy}
          bookCastingTimes={dividing.castingTimes}
        />

        <ActiveEffects
          character={character}
          concentration={concentrationSummary}
          onOpenConcentration={() => setPanelOpen(true)}
          onEndEffect={(effectId) => void execute({ kind: "end_effect", effectId })}
          onAddStatus={(nameRu) => void execute({ kind: "start_manual_effect", nameRu })}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              inFight ? setFightOverOpen(true) : startFight()
            }
            className="min-h-11 grow whitespace-nowrap rounded-xl bg-action-strong px-1 text-sm font-semibold leading-tight text-white"
          >
            {inFight ? "Окончить бой" : "Начать бой"}
          </button>
          {inFight ? (
            <button
              type="button"
              onClick={() => void execute({ kind: "begin_turn" })}
              className="min-h-11 grow whitespace-nowrap rounded-xl border border-action px-1 text-sm font-semibold text-action-strong dark:text-action"
            >
              Новый ход
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setReactionsOpen(true)}
            className="min-h-11 grow whitespace-nowrap rounded-xl border border-reaction px-1 text-sm font-semibold text-reaction-strong dark:text-reaction"
          >
            Реакции
          </button>
          <HourMark
            character={character}
            inFight={inFight}
            onRecoverMaximum={() =>
              void execute({ kind: "recover_hit_point_maximum" })
            }
          />
        </div>

        <SpellFilters
          filters={filters}
          dividing={dividing}
          mode="play"
          onChange={setFilters}
        />

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
          character={character}
          economy={economy}
          note={character.spellNotes[openSpell.id]}
          onCast={() => draftStore.getState().start(openSpell, context)}
          onNoteChange={(note) => void execute({ kind: "set_spell_note", spellId: openSpell.id, note })}
          onClose={() => setOpenSpellId(null)}
        />
      )}

      {bloodOpen ? (
        <BloodMagicWizard
          character={character}
          economy={economy}
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

      {panelOpen && concentrationSummary !== null ? (
        <ConcentrationPanel
          summary={concentrationSummary}
          onOpenSpell={() => {
            setPanelOpen(false);
            setOpenSpellId(concentrationSummary.spellId);
          }}
          onTakeDamage={() => setDamageOpen(true)}
          onDrop={async () => {
            if ((await execute({ kind: "end_concentration", reason: "manual" })) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}

      {armorClassOpen ? (
        <ArmorClassSheet
          value={Character.of(character).effects.manualAdjustment("armorAdjustment")}
          error={refusal}
          onCancel={() => {
            setRefusal(null);
            setArmorClassOpen(false);
          }}
          onSave={(value) =>
            void saveEdit({ kind: "set_armor_class_adjustment", value }, () =>
              setArmorClassOpen(false),
            )
          }
        />
      ) : null}

      {fightOverOpen ? (
        <ConfirmSheet
          title="Бой закончен?"
          body={
            combatEndRecovery(character) > 0
              ? `Регенерация вне боя идёт непрерывно: здоровье поднимется до половины максимума, это ${combatEndRecovery(character)} хитов.`
              : "Счёт раундов начнётся заново, потраченное в этом бою перестанет связывать. Лечить нечего: здоровье не ниже половины максимума."
          }
          confirmLabel="Да, бой закончен"
          cancelLabel="Нет, продолжается"
          onConfirm={finishFight}
          onCancel={() => setFightOverOpen(false)}
        />
      ) : null}

      {resourcesOpen ? (
        <ResourcesSheet
          character={character}
          onSpendSlot={(level) => void execute({ kind: "spend_spell_slot", slotLevel: level })}
          onRefundSlot={(level) => void execute({ kind: "refund_spell_slot", slotLevel: level })}
          onAdjustRunes={(delta) => void execute({ kind: "adjust_runes", delta })}
          onSunlight={(under) => void execute({ kind: "set_sunlight", underSunlight: under })}
          onClose={() => setResourcesOpen(false)}
        />
      ) : null}

      {reactionsOpen ? (
        <ReactionsSheet
          spells={reactionSpells}
          character={character}
          reactionAvailable={economy.reactionAvailable}
          runeAvailable={wardingSigilAvailable(session)}
          onCast={(spell) => {
            setReactionsOpen(false);
            draftStore.getState().start(spell, context);
          }}
          onSpendRune={async () => {
            if ((await execute({ kind: "spend_rune_on_warding_sigil" })) === null) {
              setReactionsOpen(false);
            }
          }}
          onClose={() => setReactionsOpen(false)}
        />
      ) : null}

      {damageOpen ? (
        <HitPointsSheet
          error={refusal}
          onCancel={() => {
            setRefusal(null);
            setDamageOpen(false);
          }}
          onDamage={recordDamage}
          onHeal={(amount) =>
            void saveEdit({ kind: "heal", amount }, () => setDamageOpen(false))
          }
          onTemporary={(amount) =>
            void saveEdit({ kind: "grant_temporary_hit_points", amount }, () =>
              setDamageOpen(false),
            )
          }
        />
      ) : null}

      {pendingCheck === null || concentrationSummary === null ? null : (
        <ConcentrationCheckCard
          check={pendingCheck}
          spellNameRu={concentrationSummary.nameRu}
          runeAvailable={wardingSigilAvailable(session)}
          onSuccess={() => setPendingCheck(null)}
          onSpendRune={async () => {
            if ((await execute({ kind: "spend_rune_on_warding_sigil" })) === null) {
              setPendingCheck(null);
            }
          }}
          onFail={async () => {
            if ((await execute({ kind: "end_concentration", reason: "failed_check" })) === null) {
              setPendingCheck(null);
            }
          }}
        />
      )}

      <CastWizard character={character} economy={economy} onConfirm={confirm} error={error} />
    </div>
  );
}
