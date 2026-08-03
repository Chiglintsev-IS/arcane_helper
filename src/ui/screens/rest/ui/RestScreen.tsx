"use client";

import { useState, useMemo } from "react";

import { longRest, shortRest, useArcaneRecovery } from "@/core/application/useCases/rest";
import { recoverHitPointMaximum } from "@/core/application/useCases/health";
import { toggleMaterial } from "@/core/application/useCases/library";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ArcaneRecoverySheet } from "@/ui/features/arcane-recovery/ui/ArcaneRecoverySheet";
import { CampScreen } from "@/ui/widgets/camp/ui/CampScreen";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { endEffect, startManualEffect } from "@/core/application/useCases/effects";
import { dividingCategories } from "@/ui/features/filter-spells/model/filters";
import { spellsForScreen } from "@/ui/shared/model/spellList";

export function RestScreen() {
  const { clock, session: sessionStore } = useStores();
  const session = useSession((state) => state.session)!;
  const spells = useSession((state) => state.spellCatalog);

  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2">
        <ResourceHeader
          character={character}
          economy={economy}
          bookCastingTimes={dividing.castingTimes}
          onOpenArmorClass={() => {}}
          onOpenHitPoints={() => {}}
          onEditResources={() => {}}
        />

        <ActiveEffects
          character={character}
          concentration={concentrationSummary}
          onOpenConcentration={() => {}}
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
        <CampScreen
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
    </div>
  );
}
