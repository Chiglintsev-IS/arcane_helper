"use client";

import { useState, useMemo } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import type { Command } from "@/contract/commands";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";

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
  const error = useSession((state) => state.error);
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
  const [checkOpen, setCheckOpen] = useState(false);

  const execute = sessionStore.getState().execute;
  const [refusal, setRefusal] = useState<string | null>(null);

  /** Правка уходит владельцу: прошла — шторка закрывается, отказал — причина остаётся в шторке. */
  const saveEdit = async (command: Command, close: () => void): Promise<void> => {
    const reason = await applyEdit(sessionStore, command);
    setRefusal(reason);
    if (reason === null) close();
  };
  const turn = snapshot.turn;
  const { inFight } = turn;
  // Строка того заклинания, которое набирают в мастере: способы, цена и вердикт приезжают ею.
  const castRow = snapshot.spells.find((candidate) => candidate.id === draft?.spellId) ?? null;

  const { concentration } = snapshot;
  const concentrationSummary = useMemo(() => {
    if (concentration === undefined) return null;
    return describeConcentration({
      concentration,
      row: snapshot.spells.find((candidate) => candidate.id === concentration.spellId) ?? null,
      casting: snapshot.casting,
    });
  }, [concentration, snapshot.spells, snapshot.casting]);

  const { casting } = snapshot;
  const inMode = spellsForScreen(snapshot.spells, "play");
  const shown = filterSpells(inMode, filters);
  const dividing = dividingCategories(inMode);
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

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
        bloodMagic={snapshot.bloodMagic}
        casting={casting}
        resources={snapshot.resources}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  const listLabel = spellListLabel(bloodShown);

  const recordDamage = async (damage: number, fire: boolean): Promise<void> => {
    if ((await execute({ kind: "take_damage", damage, fire })) !== null) return;
    setDamageOpen(false);
    setPanelOpen(false);
    setCheckOpen(true);
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
            sheet={snapshot.sheet}
            resources={snapshot.resources}
            onOpenArmorClass={() => setArmorClassOpen(true)}
            onOpenHitPoints={() => setDamageOpen(true)}
            onEditResources={() => setResourcesOpen(true)}
          />
        </div>

        <ResourceBadges
          sheet={snapshot.sheet}
          resources={snapshot.resources}
          turn={snapshot.turn}
          bookCastingTimes={dividing.castingTimes}
        />

        <ActiveEffects
          effects={snapshot.effects}
          armorClass={snapshot.sheet.armorClass.value}
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
            nextHour={snapshot.recovery.nextHour}
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
          value={snapshot.resources.armorClassAdjustment}
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
            snapshot.recovery.combatEndRecovery > 0
              ? `Регенерация вне боя идёт непрерывно: здоровье поднимется до половины максимума, это ${snapshot.recovery.combatEndRecovery} хитов.`
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
          resources={snapshot.resources}
          onSpendSlot={(level) => void execute({ kind: "spend_spell_slot", slotLevel: level })}
          onRefundSlot={(level) => void execute({ kind: "refund_spell_slot", slotLevel: level })}
          onAdjustRunes={(delta) => void execute({ kind: "adjust_runes", delta })}
          onSunlight={(under) => void execute({ kind: "set_sunlight", underSunlight: under })}
          onClose={() => setResourcesOpen(false)}
        />
      ) : null}

      {reactionsOpen ? (
        <ReactionsSheet
          rows={inMode}
          armorClass={snapshot.sheet.armorClass.value}
          runesRemaining={snapshot.resources.runes.remaining}
          reactionAvailable={turn.reactionAvailable}
          runeAvailable={snapshot.resources.wardingSigilAvailable}
          onCast={(row) => {
            setReactionsOpen(false);
            draftStore.getState().start(row);
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

      {/*
       * Проверка приходит снимком: какого броска требует последний урон, знают правила, а экран
       * решает лишь, открыта ли карточка. Ответом на неё служит следующая команда — потраченная
       * руна или снятая концентрация, — и проверка уходит из снимка сама.
       */}
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

      <CastWizard
        row={castRow}
        resources={snapshot.resources}
        hitDice={snapshot.sheet.hitPoints.hitDice}
        onConfirm={confirm}
        error={error}
      />
    </div>
  );
}
