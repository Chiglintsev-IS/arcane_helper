"use client";

import { useState, useMemo } from "react";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import type { Command } from "@/contract/commands";
import type { SpellRowView } from "@/contract/views";
import { toCastCommand, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";

import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { ActiveEffectsSheet } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";
import { ArmorClassSheet } from "@/ui/features/edit-armor-class/ui/ArmorClassSheet";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";
import { BloodMagicWizard } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { HourMark } from "@/ui/features/rest/ui/HourMark";
import { REACTIONS_LABEL, ReactionsSheet } from "@/ui/features/reactions/ui/ReactionsSheet";
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
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { TONE_CLASS } from "@/ui/shared/ui/tone";

/**
 * Имя раздела уже творённого: одно слово и одна строка на заголовок и на произносимое имя списка.
 * Второе имя тому же разделу читалось бы как второй раздел.
 */
const FREQUENT_LABEL = "Часто";

export function GameScreen() {
  const { draft: draftStore, session: sessionStore } = useStores();
  const error = useSession((state) => state.error);
  const snapshot = useSession((state) => state.snapshot)!;
  const draft = useDraft((state) => state.draft);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
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
  const bloodShown = matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const openRow = snapshot.spells.find((candidate) => candidate.id === openSpellId) ?? null;

  /*
   * Уже творённое уезжает наверх своим разделом и в упорядоченном ценой списке не остаётся: та же
   * строка в двух местах отняла бы место и спросила бы дважды об одном. Что творили чаще прочего,
   * знает ядро — здесь только место на экране.
   */
  const frequent = snapshot.frequentSpellIds.flatMap((id) =>
    shown.filter((spell) => spell.id === id),
  );
  const others = shown.filter((spell) => !snapshot.frequentSpellIds.includes(spell.id));

  const card = (spell: SpellRowView) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      casting={casting}
      onOpen={() => openSpell(spell.id)}
    />
  );

  const rows = others.map(card);
  if (bloodShown) {
    rows.splice(positionInList(others, BLOOD_MAGIC_TRAITS, "play"), 0, (
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
         * называют, начиная бой, номер раунда — ведя ход, остаток реакции — открывая реакции.
         * Отдельными значками они стояли бы целой строкой ради того, что и так под пальцем.
         */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              inFight ? setFightOverOpen(true) : startFight()
            }
            className="min-h-11 grow whitespace-nowrap rounded-xl bg-action-strong px-1 text-sm font-semibold leading-tight text-white"
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
              className={`min-h-11 grow whitespace-nowrap rounded-xl px-1 text-sm font-semibold leading-tight text-action-strong dark:text-action-bright ${SURFACE_CONTROL}`}
            >
              Новый ход
              <span className="block text-[0.625rem] font-normal leading-tight">
                раунд {turn.round}
              </span>
            </button>
          ) : null}
          {/*
           * Подпись короткая, произносимое имя полное: слово «реакция» звучит для читающей вслух
           * программы и не занимает места там, где его нет.
           */}
          <button
            type="button"
            onClick={() => setReactionsOpen(true)}
            aria-label={
              inFight
                ? `${REACTIONS_LABEL}. Реакция ${turn.reactionAvailable ? "доступна" : "израсходована"}`
                : REACTIONS_LABEL
            }
            className={`min-h-11 grow whitespace-nowrap rounded-xl px-1 text-sm font-semibold leading-tight ${
              turn.reactionAvailable || !inFight
                ? "bg-reaction/20 text-reaction-strong dark:text-reaction-bright"
                : `text-slate-600 dark:text-slate-400 ${SURFACE_GROUP}`
            }`}
          >
            {REACTIONS_LABEL}
            {inFight ? (
              <span className="block text-[0.625rem] font-normal leading-tight">
                <span aria-hidden="true">{turn.reactionAvailable ? "✓" : "✗"}</span>{" "}
                {turn.reactionAvailable ? "доступна" : "израсходована"}
              </span>
            ) : null}
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
          searchOpen={searchOpen}
          onChange={setFilters}
          onSearchToggle={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        />

        {/*
         Общая причина названа один раз и над списком: под каждой строкой она стояла одной и той же
         фразой у двенадцати строк из пятнадцати и вытесняла ту причину, которая у строки своя.
         */}
        {snapshot.spellsRefusalRu === undefined ? null : (
          <p className={`rounded-lg px-2 py-1 text-xs font-medium ${TONE_CLASS.reaction}`}>
            Недоступно: {snapshot.spellsRefusalRu}
          </p>
        )}

        {/*
         * Уже творённое стоит именами, а не карточками: карточка отвечает «что это и чем платить»,
         * а повторяющий спросил это в тот ход, когда творил впервые, и сейчас ищет имя. Столбцом
         * карточек раздел уносил весь экран и отодвигал упорядоченный список за нижний край.
         *
         * Слово «Часто» стоит первым в самом ряду, а не строкой над ним: строка над списком стоит
         * карточки списка, а ряд имён без слова читался бы второй полосой фильтров.
         *
         * Имена переносятся, а не прокручиваются, — по тому же правилу, что и переключатели:
         * имя за краем экрана — имя, которого для игрока нет.
         */}
        {frequent.length === 0 ? null : (
          <div className="flex flex-wrap items-start gap-x-2">
            <h2 className="flex min-h-11 items-center text-[0.6875rem] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {FREQUENT_LABEL}
            </h2>
            <ul aria-label={FREQUENT_LABEL} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {frequent.map((spell) => (
                <li key={spell.id}>
                  <button
                    type="button"
                    onClick={() => openSpell(spell.id)}
                    className={`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium ${SURFACE_CONTROL}`}
                  >
                    {spell.nameRu}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rows.length > 0 ? (
          <ul aria-label={listLabel} className="flex flex-col gap-2">
            {rows}
          </ul>
        ) : null}
        {rows.length === 0 && frequent.length === 0 ? (
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
          onAdjustLastHint={(delta) => void execute({ kind: "adjust_last_hint", delta })}
          onSunlight={(under) => void execute({ kind: "set_sunlight", underSunlight: under })}
          onClose={() => setResourcesOpen(false)}
        />
      ) : null}

      {reactionsOpen ? (
        <ReactionsSheet
          rows={inMode}
          armorClass={snapshot.sheet.armorClass}
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
