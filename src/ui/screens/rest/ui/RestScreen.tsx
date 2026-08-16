"use client";

import { useState, useMemo } from "react";

import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ActiveEffectsSheet } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";
import { ArcaneRecoverySheet } from "@/ui/features/arcane-recovery/ui/ArcaneRecoverySheet";
import { ArmorClassSheet } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { Camp } from "@/ui/widgets/camp/ui/Camp";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { ResourceBadges, ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { ResourcesSheet } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { dividingCategories } from "@/ui/features/filter-spells/model/filters";
import { spellsForScreen } from "@/ui/shared/model/spellList";

export function RestScreen() {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot)!;

  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [armorClassOpen, setArmorClassOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);

  const execute = sessionStore.getState().execute;

  const { concentration } = snapshot;
  const concentrationSummary = useMemo(() => {
    if (concentration === undefined) return null;
    return describeConcentration({
      concentration,
      row: snapshot.spells.find((candidate) => candidate.id === concentration.spellId) ?? null,
      casting: snapshot.casting,
    });
  }, [concentration, snapshot.spells, snapshot.casting]);
  const inMode = spellsForScreen(snapshot.spells, "rest");
  const dividing = dividingCategories(inMode);

  const recordDamage = async (damage: number, fire: boolean): Promise<void> => {
    if ((await execute({ kind: "take_damage", damage, fire })) !== null) return;
    setDamageOpen(false);
    setActiveOpen(false);
    setCheckOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Поля те же, что у «Игры»: одна и та же шапка не вправе стоять в двух режимах по-разному. */}
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-2">
        <ResourceHeader
          sheet={snapshot.sheet}
          resources={snapshot.resources}
          onOpenArmorClass={() => setArmorClassOpen(true)}
          onOpenHitPoints={() => setDamageOpen(true)}
          onEditResources={() => setResourcesOpen(true)}
        />

        {/* Тот же ряд, что и в «Игре»: что держится и что уже потрачено — об одном мгновении. */}
        <div className="flex flex-wrap items-center gap-2">
          <ActiveEffects
            effects={snapshot.effects}
            armorClass={snapshot.sheet.armorClass}
            concentration={concentrationSummary}
            onOpen={() => setActiveOpen(true)}
          />

          <ResourceBadges
            sheet={snapshot.sheet}
            resources={snapshot.resources}
            turn={snapshot.turn}
            bookCastingTimes={dividing.castingTimes}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HourMark
            nextHour={snapshot.recovery.nextHour}
            onRecoverMaximum={() =>
              void execute({ kind: "recover_hit_point_maximum" })
            }
          />
        </div>
      </div>

      {/*
       Операции прижаты к нижнему краю, а не к верхнему: содержимое привала занимает четверть
       экрана, и пустота под кнопками отодвигала главное действие из-под большого пальца. Пустота
       остаётся, но уходит наверх, где ничего не стоит. Отступом сверху её не заменить: он замер бы
       на одном размере экрана, а прижатие держится на всех.
       */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <div className="flex min-h-full flex-col justify-end">
          <Camp
            recovery={snapshot.recovery}
            onShortRest={() => void execute({ kind: "short_rest" })}
            onLongRest={() => setLongRestOpen(true)}
            onArcaneRecovery={() => setRecoveryOpen(true)}
          />
        </div>
      </div>

      {longRestOpen ? (
        <ConfirmSheet
          title="Долгий отдых?"
          body="Вернутся все ячейки и руны, снимется концентрация, закроются эффекты короче отдыха, обнулятся очки заклинаний и временные хиты."
          confirmLabel={BUTTON_LABELS.confirm}
          cancelLabel={BUTTON_LABELS.dismiss}
          onConfirm={async () => {
            if ((await execute({ kind: "long_rest" })) === null) setLongRestOpen(false);
          }}
          onCancel={() => setLongRestOpen(false)}
        />
      ) : null}

      {recoveryOpen ? (
        <ArcaneRecoverySheet
          recovery={snapshot.recovery.arcaneRecovery}
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
          value={snapshot.resources.armorClassAdjustment}
          onCancel={() => setArmorClassOpen(false)}
          onSave={async (value) => {
            const failure = await execute({ kind: "set_armor_class_adjustment", value });
            if (failure === null) setArmorClassOpen(false);
          }}
        />
      ) : null}

      {damageOpen ? (
        <HitPointsSheet
          hitPoints={snapshot.sheet.hitPoints}
          onCancel={() => setDamageOpen(false)}
          onDamage={recordDamage}
          onMaximum={async (change) => {
            if ((await execute({ kind: "edit_health", ...change })) === null) setDamageOpen(false);
          }}
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
          resources={snapshot.resources}
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
      {activeOpen ? (
        <ActiveEffectsSheet
          effects={snapshot.effects}
          armorClass={snapshot.sheet.armorClass}
          concentration={concentrationSummary}
          onTakeDamage={() => setDamageOpen(true)}
          onDropConcentration={async () => {
            if ((await execute({ kind: "end_concentration", reason: "manual" })) === null) {
              setActiveOpen(false);
            }
          }}
          onEndEffect={(effectId) => void execute({ kind: "end_effect", effectId })}
          onAddStatus={(nameRu) => void execute({ kind: "start_manual_effect", nameRu })}
          onClose={() => setActiveOpen(false)}
        />
      ) : null}

      {!checkOpen || concentration?.checkAfterDamage === undefined ? null : (
        <ConcentrationCheckCard
          check={concentration.checkAfterDamage}
          spellNameRu={concentration.nameRu}
          runeAvailable={snapshot.resources.wardingSigilAvailable}
          onSuccess={() => setCheckOpen(false)}
          onSpendRune={async () => {
            if ((await execute({ kind: "spend_rune_on_warding_sigil" })) === null) {
              setCheckOpen(false);
            }
          }}
          onFail={async () => {
            if ((await execute({ kind: "end_concentration", reason: "failed_check" })) === null) {
              setCheckOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
