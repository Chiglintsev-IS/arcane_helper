"use client";

import { useState, useMemo } from "react";

import { longRest, shortRest, useArcaneRecovery } from "@/core/application/useCases/rest";
import {
  grantTemporaryHitPoints,
  heal,
  recoverHitPointMaximum,
  setSunlight,
  takeDamage,
} from "@/core/application/useCases/health";
import { toggleMaterial } from "@/core/application/useCases/library";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { adjustRunes, refundSpellSlot, spendSpellSlot } from "@/core/application/useCases/resources";
import {
  endConcentration,
  endEffect,
  setArmorClassAdjustment,
  spendRuneOnWardingSigil,
  startManualEffect,
  wardingSigilAvailable,
} from "@/core/application/useCases/effects";
import { armorClassAdjustment } from "@/core/domain/sheet/armorClass";
import { describeConcentrationCheck, type ConcentrationCheck } from "@/core/domain/effects/concentration";
import { Sheet } from "@/core/domain/sheet/sheet";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ArcaneRecoverySheet } from "@/ui/features/arcane-recovery/ui/ArcaneRecoverySheet";
import { ArmorClassSheet } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { Camp } from "@/ui/widgets/camp/ui/Camp";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { ConcentrationPanel } from "@/ui/entities/concentration/ui/ConcentrationPanel";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { ResourceBadges, ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { ResourcesSheet } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { dividingCategories } from "@/ui/features/filter-spells/model/filters";
import { spellsForScreen } from "@/ui/shared/model/spellList";

export function RestScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const spells = useSession((state) => state.spellCatalog);

  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [armorClassOpen, setArmorClassOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingCheck, setPendingCheck] = useState<ConcentrationCheck | null>(null);

  const { character } = session;
  const apply = sessionStore.getState().apply;
  const economy = deriveTurnEconomy(session);
  const { inFight } = economy;

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
  const inMode = spellsForScreen(spells, character, "rest", inFight);
  const dividing = dividingCategories(inMode, inFight);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2">
        <ResourceHeader
          character={character}
          onOpenArmorClass={() => setArmorClassOpen(true)}
          onOpenHitPoints={() => setDamageOpen(true)}
          onEditResources={() => setResourcesOpen(true)}
        />

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
          <HourMark
            character={character}
            inFight={inFight}
            onRecoverMaximum={() =>
              apply((current) => recoverHitPointMaximum(current, clock))
            }
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <Camp
          character={character}
          inFight={inFight}
          spells={spells}
          onShortRest={() => apply((current) => shortRest(current, clock))}
          onLongRest={() => setLongRestOpen(true)}
          onArcaneRecovery={() => setRecoveryOpen(true)}
          onToggleMaterial={(spellId) => apply((current) => toggleMaterial(current, spellId, clock))}
        />
      </div>

      {longRestOpen ? (
        <ConfirmSheet
          title="Долгий отдых?"
          body="Вернутся все ячейки и руны, снимется концентрация, закроются эффекты короче отдыха, обнулятся очки заклинаний и временные хиты."
          confirmLabel="Отдохнуть"
          cancelLabel="Отмена"
          onConfirm={() => {
            if (apply((current) => longRest(current, clock)) === null) setLongRestOpen(false);
          }}
          onCancel={() => setLongRestOpen(false)}
        />
      ) : null}

      {recoveryOpen ? (
        <ArcaneRecoverySheet
          character={character}
          onConfirm={(plan) => {
            if (apply((current) => useArcaneRecovery(current, plan, clock)) === null) {
              setRecoveryOpen(false);
            }
          }}
          onCancel={() => setRecoveryOpen(false)}
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

      {/*
       * Перехода в карточку заклинания у «Привала» нет: подробная карточка живёт в «Игре» и
       * «Книге», а чужих шторок экран не открывает.
       */}
      {panelOpen && concentrationSummary !== null ? (
        <ConcentrationPanel
          summary={concentrationSummary}
          onTakeDamage={() => setDamageOpen(true)}
          onDrop={() => {
            if (apply((current) => endConcentration(current, "manual", clock)) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
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
    </div>
  );
}
