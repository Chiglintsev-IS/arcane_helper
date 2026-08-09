"use client";

import { Character } from "@/core/domain/assembly/character";
import { saveStatId } from "@/core/domain/shared/stats";
import { useState, useMemo } from "react";

import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { wardingSigilAvailable } from "@/core/application/useCases/effects";
import { describeConcentrationCheck, type ConcentrationCheck } from "@/core/domain/effects/concentration";
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
  const { session: sessionStore } = useStores();
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
  const execute = sessionStore.getState().execute;
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
          onEndEffect={(effectId) => void execute({ kind: "end_effect", effectId })}
          onAddStatus={(nameRu) => void execute({ kind: "start_manual_effect", nameRu })}
        />

        <div className="flex flex-wrap items-center gap-2">
          <HourMark
            character={character}
            inFight={inFight}
            onRecoverMaximum={() =>
              void execute({ kind: "recover_hit_point_maximum" })
            }
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <Camp
          character={character}
          inFight={inFight}
          spells={spells}
          onShortRest={() => void execute({ kind: "short_rest" })}
          onLongRest={() => setLongRestOpen(true)}
          onArcaneRecovery={() => setRecoveryOpen(true)}
          onToggleMaterial={(spellId) => void execute({ kind: "toggle_material", spellId })}
        />
      </div>

      {longRestOpen ? (
        <ConfirmSheet
          title="Долгий отдых?"
          body="Вернутся все ячейки и руны, снимется концентрация, закроются эффекты короче отдыха, обнулятся очки заклинаний и временные хиты."
          confirmLabel="Отдохнуть"
          cancelLabel="Отмена"
          onConfirm={async () => {
            if ((await execute({ kind: "long_rest" })) === null) setLongRestOpen(false);
          }}
          onCancel={() => setLongRestOpen(false)}
        />
      ) : null}

      {recoveryOpen ? (
        <ArcaneRecoverySheet
          character={character}
          onConfirm={async (plan) => {
            if ((await execute({ kind: "use_arcane_recovery", plan })) === null) {
              setRecoveryOpen(false);
            }
          }}
          onCancel={() => setRecoveryOpen(false)}
        />
      ) : null}

      {armorClassOpen ? (
        <ArmorClassSheet
          value={Character.of(character).effects.manualAdjustment("armorAdjustment")}
          onCancel={() => setArmorClassOpen(false)}
          onSave={async (value) => {
            const failure = await execute({ kind: "set_armor_class_adjustment", value });
            if (failure === null) setArmorClassOpen(false);
          }}
        />
      ) : null}

      {damageOpen ? (
        <HitPointsSheet
          onCancel={() => setDamageOpen(false)}
          onDamage={recordDamage}
          onHeal={async (amount) => {
            if ((await execute({ kind: "heal", amount })) === null) setDamageOpen(false);
          }}
          onTemporary={async (amount) => {
            if ((await execute({ kind: "grant_temporary_hit_points", amount })) === null) {
              setDamageOpen(false);
            }
          }}
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

      {/*
       * Перехода в карточку заклинания у «Привала» нет: подробная карточка живёт в «Игре» и
       * «Книге», а чужих шторок экран не открывает.
       */}
      {panelOpen && concentrationSummary !== null ? (
        <ConcentrationPanel
          summary={concentrationSummary}
          onTakeDamage={() => setDamageOpen(true)}
          onDrop={async () => {
            if ((await execute({ kind: "end_concentration", reason: "manual" })) === null) {
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
    </div>
  );
}
