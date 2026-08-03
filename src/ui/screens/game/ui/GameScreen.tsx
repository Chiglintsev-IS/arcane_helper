"use client";

import { useState, useMemo } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import { bestCastPlan } from "@/core/application/casting/castOptions";
import { toCastRequest, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";
import {
  armorClassAdjustment,
  endConcentration,
  endEffect,
  setArmorClassAdjustment,
  spendRuneOnWardingSigil,
  startManualEffect,
  wardingSigilAvailable,
} from "@/core/application/useCases/effects";
import { castSpell } from "@/core/application/useCases/casting";
import { beginTurn, combatEndRecovery, deriveTurnEconomy, endCombat, startCombat } from "@/core/application/useCases/turn";
import { adjustRunes, refundSpellSlot, spendSpellSlot } from "@/core/application/useCases/resources";
import { exchangeBlood, grantTemporaryHitPoints, heal, setSunlight, takeDamage } from "@/core/application/useCases/health";
import { describeConcentrationCheck, type ConcentrationCheck } from "@/core/domain/effects/concentration";
import { Sheet } from "@/core/domain/sheet/sheet";

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
import type { Spell } from "@/core/domain/catalog/spell";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { setSpellNote } from "@/core/application/useCases/library";
import { recoverHitPointMaximum } from "@/core/application/useCases/health";

function firstReason(
  spell: Spell,
  character: Parameters<typeof bestCastPlan>[1],
  turn: Parameters<typeof bestCastPlan>[2],
): string | null {
  const plan = bestCastPlan(spell, character, turn);
  if (plan === null) return "нет доступного способа сотворения";
  return plan.availability.warnings[0]?.reasonRu ?? null;
}

export function GameScreen() {
  const { clock, draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const error = useSession((state) => state.error);
  const spells = useSession((state) => state.spellCatalog);
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
  const apply = sessionStore.getState().apply;
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
      journal: session.journal,
    });
  }, [character, spells, session.journal]);

  const inMode = spellsForScreen(spells, character, "play", inFight);
  const shown = filterSpells(inMode, filters, context);
  const dividing = dividingCategories(inMode, inFight);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      character={character}
      unavailableReason={firstReason(spell, character, economy)}
      onOpen={() => setOpenSpellId(spell.id)}
    />
  ));
  if (bloodShown) {
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "play", inFight), 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        economy={economy}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  const listLabel = bloodShown ? "Заклинания и действия" : "Заклинания";

  const recordDamage = (damage: number, fire: boolean): void => {
    if (apply((current) => takeDamage(current, damage, clock, { fire })) !== null) return;
    setDamageOpen(false);
    setPanelOpen(false);
    if (character.concentration !== undefined) {
      setPendingCheck(
        describeConcentrationCheck(damage, Sheet.of(character).savingThrow("constitution")),
      );
    }
  };

  const startFight = (): void => {
    if (apply((current) => startCombat(current, clock)) === null) setFilters(NO_FILTERS);
  };

  const finishFight = (): void => {
    if (apply((current) => endCombat(current, clock)) !== null) return;
    setFilters(NO_FILTERS);
    setFightOverOpen(false);
  };

  const confirm = (confirmed: CastDraft): void => {
    const failure = apply((current) => castSpell(current, toCastRequest(confirmed), clock));
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
          onEndEffect={(effectId) => apply((current) => endEffect(current, effectId, clock))}
          onAddStatus={(nameRu) => apply((current) => startManualEffect(current, { nameRu }, clock))}
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
              onClick={() => apply((current) => beginTurn(current, clock))}
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
              apply((current) => recoverHitPointMaximum(current, clock))
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

      {openSpell === null || draft !== null ? null : (
        <SpellCardDetails
          spell={openSpell}
          character={character}
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

      {panelOpen && concentrationSummary !== null ? (
        <ConcentrationPanel
          summary={concentrationSummary}
          onOpenSpell={() => {
            setPanelOpen(false);
            setOpenSpellId(concentrationSummary.spellId);
          }}
          onTakeDamage={() => setDamageOpen(true)}
          onDrop={() => {
            if (apply((current) => endConcentration(current, "manual", clock)) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}

      {armorClassOpen ? (
        <ArmorClassSheet
          value={armorClassAdjustment(character)}
          onCancel={() => setArmorClassOpen(false)}
          onSave={(value) => {
            const failure = apply((current) => setArmorClassAdjustment(current, value, clock));
            if (failure === null) setArmorClassOpen(false);
          }}
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
          onSpendSlot={(level) => apply((current) => spendSpellSlot(current, level, clock))}
          onRefundSlot={(level) => apply((current) => refundSpellSlot(current, level, clock))}
          onAdjustRunes={(delta) => apply((current) => adjustRunes(current, delta, clock))}
          onSunlight={(under) => apply((current) => setSunlight(current, under, clock))}
          onClose={() => setResourcesOpen(false)}
        />
      ) : null}

      {reactionsOpen ? (
        <ReactionsSheet
          spells={inMode}
          character={character}
          reactionAvailable={economy.reactionAvailable}
          runeAvailable={wardingSigilAvailable(session)}
          onCast={(spell) => {
            setReactionsOpen(false);
            draftStore.getState().start(spell, context);
          }}
          onSpendRune={() => {
            if (apply((current) => spendRuneOnWardingSigil(current, clock)) === null) {
              setReactionsOpen(false);
            }
          }}
          onClose={() => setReactionsOpen(false)}
        />
      ) : null}

      {damageOpen ? (
        <HitPointsSheet
          onCancel={() => setDamageOpen(false)}
          onDamage={recordDamage}
          onHeal={(amount) => {
            if (apply((current) => heal(current, amount, clock)) === null) setDamageOpen(false);
          }}
          onTemporary={(amount) => {
            if (apply((current) => grantTemporaryHitPoints(current, amount, clock)) === null) {
              setDamageOpen(false);
            }
          }}
        />
      ) : null}

      {pendingCheck === null || concentrationSummary === null ? null : (
        <ConcentrationCheckCard
          check={pendingCheck}
          spellNameRu={concentrationSummary.nameRu}
          runeAvailable={wardingSigilAvailable(session)}
          onSuccess={() => setPendingCheck(null)}
          onSpendRune={() => {
            if (apply((current) => spendRuneOnWardingSigil(current, clock)) === null) {
              setPendingCheck(null);
            }
          }}
          onFail={() => {
            if (apply((current) => endConcentration(current, "failed_check", clock)) === null) {
              setPendingCheck(null);
            }
          }}
        />
      )}

      <CastWizard character={character} economy={economy} onConfirm={confirm} error={error} />
    </div>
  );
}
