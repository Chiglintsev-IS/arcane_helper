"use client";

import { useState, useMemo } from "react";

import { lastHintTraits, wardingSigilTraits } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import type { Command } from "@/contract/commands";
import type { SpellRowView } from "@/contract/views";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ActiveEffectsSheet } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";
import { ArmorClassSheet } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { LastHintRow } from "@/ui/features/last-hint/ui/LastHintRow";
import { LastHintSheet } from "@/ui/features/last-hint/ui/LastHintSheet";
import { WardingSigilRow } from "@/ui/features/warding-sigil/ui/WardingSigilRow";
import { WardingSigilSheet } from "@/ui/features/warding-sigil/ui/WardingSigilSheet";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { ResourceBadges, ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { ResourcesSheet } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { spellListLabel } from "@/ui/shared/lib/spellLabels";
import { applyEdit } from "@/ui/shared/model/editing";
import { signed } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";
import { RULE_MARK } from "@/ui/shared/ui/rule";

export function GameScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const error = useSession((state) => state.error);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [fightOverOpen, setFightOverOpen] = useState(false);
  const [sigilOpen, setSigilOpen] = useState(false);
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
  /**
   * Поиск — способ дойти до строки, а не отбор: закрываясь, он отпускает список целиком. Иначе
   * набранное слово продолжало бы прятать четырнадцать строк из пятнадцати, а поля, которое это
   * объясняет, на экране уже нет.
   */
  const closeSearch = (): void => {
    setSearchOpen(false);
    setFilters((current) => ({ ...current, query: "" }));
  };

  const openSpell = (spellId: string): void => {
    closeSearch();
    setOpenSpellId(spellId);
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
  const hintTraits = lastHintTraits(snapshot.resources.lastHint.nameRu);
  const hintShown = matchesActionRow(hintTraits, filters);
  const sigilTraits = wardingSigilTraits(snapshot.resources.runes.nameRu);
  const sigilShown = matchesActionRow(sigilTraits, filters);
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

  const card = (spell: SpellRowView) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      armorClass={snapshot.sheet.armorClass}
      onOpen={() => openSpell(spell.id)}
    />
  );

  const rows = shown.map(card);
  if (hintShown) {
    rows.splice(positionInList(shown, hintTraits, "play"), 0, (
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
  if (sigilShown) {
    rows.splice(positionInList(shown, sigilTraits, "play"), 0, (
      <WardingSigilRow
        key="warding-sigil"
        resources={snapshot.resources}
        onOpen={() => {
          closeSearch();
          setRefusal(null);
          setSigilOpen(true);
        }}
      />
    ));
  }
  const listLabel = spellListLabel(hintShown || sigilShown);

  const recordDamage = async (damage: number, fire: boolean): Promise<void> => {
    if ((await execute({ kind: "take_damage", damage, fire })) !== null) return;
    setDamageOpen(false);
    setActiveOpen(false);
    setCheckOpen(true);
  };

  const startFight = async (): Promise<void> => {
    if ((await execute({ kind: "start_combat" })) !== null) return;
    setFilters(NO_FILTERS);
    setSearchOpen(false);
  };

  const finishFight = async (): Promise<void> => {
    if ((await execute({ kind: "end_combat" })) !== null) return;
    setFilters(NO_FILTERS);
    setSearchOpen(false);
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

        {/*
         * Что сейчас верно — одной строкой: что держится и что уже потрачено в этом ходу. Оба
         * ответа об одном мгновении, и разведённые по двум строкам они стоили бы той строки
         * списка, ради которой экран и разгружают.
         */}
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
          />
        </div>

        {/*
         * Число, которое произносят, стоит на кнопке, которой в этот миг и пользуются: инициативу
         * называют, начиная бой, номер раунда — ведя ход. Отдельными значками они стояли бы целой
         * строкой ради того, что и так под пальцем.
         */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              inFight ? setFightOverOpen(true) : startFight()
            }
            className={`min-h-11 grow whitespace-nowrap ${SURFACE_PRIMARY} px-1 text-sm font-semibold leading-tight`}
          >
            {inFight ? "Окончить бой" : "Начать бой"}
            {inFight ? null : (
              <span className="block text-[0.625rem] font-normal leading-tight">
                инициатива {signed(snapshot.resources.initiative)}
              </span>
            )}
          </button>
          {inFight ? (
            <button
              type="button"
              onClick={() => void execute({ kind: "begin_turn" })}
              className={`min-h-11 grow whitespace-nowrap px-1 text-sm font-semibold leading-tight text-action ${SURFACE_CONTROL}`}
            >
              Новый ход
              <span className="block text-[0.625rem] font-normal leading-tight">
                раунд {turn.round}
              </span>
            </button>
          ) : null}
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
          searchOpen={searchOpen}
          onChange={setFilters}
          onSearchToggle={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        />

        {/*
         Общая причина названа один раз и над списком: под каждой строкой она стояла одной и той же
         фразой у двенадцати строк из пятнадцати и вытесняла ту причину, которая у строки своя.
         */}
        {snapshot.spellsRefusalRu === undefined ? null : (
          <p className={`px-2 py-1 text-xs font-medium ${RULE_MARK.reaction}`}>
            Недоступно: {snapshot.spellsRefusalRu}
          </p>
        )}

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
          onCast={() => {
            const ready = draftStore.getState().start(openRow);
            if (ready !== null) void confirm(ready);
          }}
          onNoteChange={(note) => void execute({ kind: "set_spell_note", spellId: openRow.id, note })}
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


      {activeOpen ? (
        <ActiveEffectsSheet
          effects={snapshot.effects}
          armorClass={snapshot.sheet.armorClass}
          concentration={concentrationSummary}
          onOpenSpell={
            concentrationSummary === null
              ? undefined
              : () => {
                  setActiveOpen(false);
                  setOpenSpellId(concentrationSummary.spellId);
                }
          }
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

      {sigilOpen ? (
        <WardingSigilSheet
          resources={snapshot.resources}
          refusalRu={refusal}
          onSpendRune={() =>
            void saveEdit({ kind: "spend_rune_on_warding_sigil" }, () => setSigilOpen(false))
          }
          onClose={() => {
            setRefusal(null);
            setSigilOpen(false);
          }}
        />
      ) : null}

      {damageOpen ? (
        <HitPointsSheet
          error={refusal}
          hitPoints={snapshot.sheet.hitPoints}
          onCancel={() => {
            setRefusal(null);
            setDamageOpen(false);
          }}
          onDamage={recordDamage}
          onMaximum={(change) =>
            void saveEdit({ kind: "edit_health", ...change }, () => setDamageOpen(false))
          }
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
        choices={snapshot.choices}
        hitDice={snapshot.sheet.hitPoints.hitDice}
        onConfirm={confirm}
        error={error}
      />
    </div>
  );
}
