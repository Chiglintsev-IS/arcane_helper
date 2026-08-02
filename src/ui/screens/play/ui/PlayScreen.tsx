/**
 * Главный экран — единственная точка входа во время игры.
 *
 * Порядок сверху вниз: переключатель режима, шапка ресурсов, действующее, ряд кнопок, операции
 * режима, фильтры, прокручиваемая область. Прокручивается только она.
 *
 * Единственная точка изменения состояния персонажа — `apply`. Компоненты списка и карточки
 * состояние не трогают: они сообщают о нажатии, а операцию выбирает этот экран.
 */

"use client";

import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { Character } from "@/core/domain/character/character";
import { setScreenMode, setSpellNote, toggleMaterial, togglePreparation } from "@/core/application/useCases/library";
import { longRest, shortRest, useArcaneRecovery } from "@/core/application/useCases/rest";
import { exchangeBlood, grantTemporaryHitPoints, heal, recoverHitPointMaximum, setSunlight, takeDamage } from "@/core/application/useCases/health";
import { endConcentration, endEffect, spendRuneOnWardingSigil, wardingSigilAvailable } from "@/core/application/useCases/effects";
import { castSpell } from "@/core/application/useCases/casting";
import { beginTurn, combatEndRecovery, deriveTurnEconomy, endCombat, startCombat } from "@/core/application/useCases/turn";
import { adjustRunes, refundSpellSlot, spendSpellSlot } from "@/core/application/useCases/resources";
import type { ScreenMode } from "@/core/shared/screenMode";
import { positionInList, spellsForScreen } from "@/ui/shared/model/spellList";
import { NO_FILTERS, dividingCategories, filterSpells, matchesActionRow } from "@/ui/features/filter-spells/model/filters";
import { useMemo, useState } from "react";

import { ArcaneRecoverySheet } from "@/ui/features/arcane-recovery/ui/ArcaneRecoverySheet";
import { BloodMagicWizard } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";
import { CampSheet } from "@/ui/widgets/camp/ui/CampSheet";
import { CastWizard } from "@/ui/widgets/cast-wizard/ui/CastWizard";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { DataSheet } from "@/ui/features/data-exchange/ui/DataSheet";
import { ConcentrationCheckCard } from "@/ui/features/concentration-check/ui/ConcentrationCheckCard";
import { ConcentrationPanel } from "@/ui/entities/concentration/ui/ConcentrationPanel";
import { ActiveEffects } from "@/ui/widgets/active-effects/ui/ActiveEffects";
import { CharacterSheetScreen } from "@/ui/widgets/character-sheet/ui/CharacterSheetScreen";
import { JournalScreen } from "@/ui/widgets/journal/ui/JournalScreen";
import { ModeSwitcher } from "@/ui/features/screen-mode/ui/ModeSwitcher";
import { ReactionsSheet } from "@/ui/features/reactions/ui/ReactionsSheet";
import { ResourceHeader } from "@/ui/widgets/resource-header/ui/ResourceHeader";
import { ResourcesSheet } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import { SpellCardCompact } from "@/ui/entities/spell/ui/SpellCardCompact";
import { SpellCardDetails } from "@/ui/widgets/spell-details/ui/SpellCardDetails";
import type { Spell } from "@/core/domain/catalog/spell";
import { HitPointsSheet } from "@/ui/features/edit-hit-points/ui/HitPointsSheet";
import { AbilitySheet } from "@/ui/features/edit-character-sheet/ui/AbilitySheet";
import { ArmorSheet } from "@/ui/features/edit-character-sheet/ui/ArmorSheet";
import { InventorySheet } from "@/ui/features/edit-character-sheet/ui/InventorySheet";
import { HealthSheet } from "@/ui/features/edit-character-sheet/ui/HealthSheet";
import { IdentitySheet } from "@/ui/features/edit-character-sheet/ui/IdentitySheet";
import { ItemBonusesSheet } from "@/ui/features/edit-character-sheet/ui/ItemBonusesSheet";
import { LevelSheet } from "@/ui/features/edit-character-sheet/ui/LevelSheet";
import { MarksSheet } from "@/ui/features/edit-character-sheet/ui/MarksSheet";
import { OverridePickerSheet } from "@/ui/features/edit-character-sheet/ui/OverridePickerSheet";
import { OverrideSheet } from "@/ui/features/edit-character-sheet/ui/OverrideSheet";
import {
  addItem,
  editArmorClassBase,
  editOtherBonuses,
  removeItem,
  toggleWorn,
} from "@/core/application/useCases/equipment";
import {
  changeLevel,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  setOverride,
} from "@/core/application/useCases/sheet";
import { deriveNumbers, type DerivedId } from "@/core/domain/sheet/derived";
import { ABILITIES } from "@/core/domain/character/skills";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Sheet } from "@/core/domain/sheet/sheet";
import { describeConcentrationCheck, type ConcentrationCheck } from "@/core/domain/effects/concentration";
import { describeConcentration } from "@/ui/entities/concentration/lib/summary";
import { ascensionTierRate } from "@/core/domain/vitality/blood";
import { exportFileName, exportSnapshot, parseImport } from "@/core/application/dataExchange";
import { bestCastPlan } from "@/core/application/casting/castOptions";
import { toCastRequest, type CastDraft } from "@/ui/features/cast-spell/model/castDraftStore";
import { useDraft, useSession, useStores } from "@/ui/shared/model/storeContext";
import { undoLast } from "@/core/application/session";

/**
 * Первая причина, по которой заклинание сейчас не применить, — для строки списка.
 *
 * Причина берётся у лучшего способа сотворения, а не у первого попавшегося: строка обязана называть
 * то же, что скажет мастер применения.
 */
function firstReason(
  spell: Spell,
  character: Parameters<typeof bestCastPlan>[1],
  turn: Parameters<typeof bestCastPlan>[2],
): string | null {
  const plan = bestCastPlan(spell, character, turn);
  if (plan === null) return "нет доступного способа сотворения";
  return plan.availability.warnings[0]?.reasonRu ?? null;
}

/**
 * Что показывает каждый режим. Таблица, а не условия по месту: состав экрана — одно решение, и
 * читать его надо целиком, иначе один режим однажды снова покажет чужое.
 *
 * Отметки схватки стоят в «Игре» всегда: начало и конец боя — её собственные операции. Что внутри
 * «Игры» убирает сам бой — отдых и «Новый ход», — таблице не принадлежит: это состояние игры, а не
 * режима, и решается оно там, где стоит блок.
 */
const SCREEN_PARTS: Record<
  ScreenMode,
  {
    /** Имя, числа боя, ячейки, прочие ресурсы. */
    resources: boolean;
    /** Концентрация и активные эффекты. */
    effects: boolean;
    spellList: boolean;
    /** «Начать бой» / «Окончить бой» и «Новый ход». */
    encounter: boolean;
    reactions: boolean;
    /** Счётчик подготовки и кнопки подготовки в строках. */
    preparation: boolean;
    /** Отдых, восстановление, список покупок. */
    camp: boolean;
    journal: boolean;
    /** Лист персонажа целиком. */
    sheet: boolean;
  }
> = {
  // prettier-ignore
  play: { resources: true, effects: true, spellList: true, encounter: true, reactions: true, preparation: false, camp: true, journal: false, sheet: false },
  // prettier-ignore
  book: { resources: false, effects: false, spellList: true, encounter: false, reactions: false, preparation: true, camp: false, journal: false, sheet: false },
  // prettier-ignore
  journal: { resources: false, effects: false, spellList: false, encounter: false, reactions: false, preparation: false, camp: false, journal: true, sheet: false },
  // prettier-ignore
  sheet: { resources: false, effects: false, spellList: false, encounter: false, reactions: false, preparation: false, camp: false, journal: false, sheet: true },
};

export function PlayScreen() {
  const { clock, draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session);
  const status = useSession((state) => state.status);
  const error = useSession((state) => state.error);
  const draft = useDraft((state) => state.draft);
  // Каталог — данные, а не константа модуля: импорт подменяет его целиком.
  const spells = useSession((state) => state.spellCatalog);
  const catalogSource = useSession((state) => state.spellCatalogSource);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [campOpen, setCampOpen] = useState(false);
  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [fightOverOpen, setFightOverOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<ConcentrationCheck | null>(null);
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [openOverrideId, setOpenOverrideId] = useState<DerivedId | null>(null);
  // Блок характеристики называет себя `ability:<имя>`: шторка у каждой своя, как и блок.
  const editedAbility = ABILITIES.find((ability) => openBlockId === `ability:${ability}`) ?? null;

  const economy = useMemo(
    () => (session === null ? null : deriveTurnEconomy(session)),
    [session],
  );

  /**
   * Описание концентрации собирается из контента по `spellId` эффекта. Карточки может не быть —
   * состояние пришло импортом из другой сборки — тогда описание деградирует, но не исчезает:
   * концентрация не может уйти с экрана незаметно.
   */
  const concentrationSummary = useMemo(() => {
    if (session === null) return null;
    const effect = session.character.activeEffects.find((candidate) => candidate.isConcentration);
    if (effect === undefined) return null;
    return describeConcentration({
      spell: spells.find((candidate) => candidate.id === effect.spellId) ?? null,
      effect,
      character: session.character,
      journal: session.journal,
    });
  }, [session, spells]);

  if (status === "loading" || session === null || economy === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-sm text-slate-500">
        {status === "error" ? (error ?? "Состояние не прочитано") : "Загрузка состояния…"}
      </main>
    );
  }

  const { character } = session;
  const context = { character, turn: economy };
  const apply = sessionStore.getState().apply;
  const mode = character.screenMode;
  const parts = SCREEN_PARTS[mode];
  const { inFight } = economy;
  // Режим отбирает раньше фильтров: фильтр сужает список внутри режима, режим задаёт сам список.
  // Карточка при этом открывается из всей книги — режим не должен закрывать уже открытое.
  const inMode = spellsForScreen(spells, character, inFight);
  const shown = filterSpells(inMode, filters, context);
  const dividing = dividingCategories(inMode, inFight);
  const bloodShown = parts.spellList && matchesActionRow(BLOOD_MAGIC_TRAITS, filters);
  const limit = Sheet.of(character).preparationLimit;
  const derivedNumbers = Sheet.of(character).derived();
  // Что дала бы формула без единой перебивки: шторка обязана назвать, от чего отступает игрок.
  const formulaNumbers = deriveNumbers({
    ...character,
    bonuses: Equipment.of(character).bonuses,
    armorClassBase: character.equipment.armorClassBase,
    overrides: { saves: {}, skills: {} },
  });

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      character={character}
      unavailableReason={firstReason(spell, character, economy)}
      onOpen={() => setOpenSpellId(spell.id)}
      onTogglePrepared={
        parts.preparation
          ? () => apply((current) => togglePreparation(current, spell, limit, clock))
          : undefined
      }
    />
  ));
  if (bloodShown) {
    // Один список, а не два: ячейку обмен не тратит, значит по цене он стоит там же, где заговоры.
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, mode, inFight), 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        economy={economy}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  // Имя списка называет то, что в нём есть: в «Книге» — только заклинания, в бою ещё «Магия крови».
  const listLabel = bloodShown ? "Заклинания и действия" : "Заклинания";
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;

  /**
   * Урон из любой точки ввода: хиты списываются, и при активной концентрации сразу предлагается
   * проверка.
   *
   * Обработчик один на все точки ввода намеренно: вторая реализация рано или поздно забыла бы
   * предложить проверку, а незаметно потерять концентрацию нельзя. Обмен хитов на очки сюда не
   * идёт — это не урон и проверки не требует.
   */
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

  /**
   * Смена режима.
   *
   * Ничего не спрашивает: игрок мог уйти в книгу за справкой посреди боя, и вопрос «бой закончен?»
   * на каждый такой взгляд — шум. Начало и конец боя отмечаются кнопками в самом бою.
   */
  const changeMode = (next: ScreenMode): void => {
    // Наборы фильтров у режимов разные, и выбранное в одном становится в другом невидимым:
    // «Ритуал» из «Книги» молча сузил бы боевой список до пустого, а переключателя, которым это
    // снять, на экране уже нет.
    setFilters(NO_FILTERS);
    apply((current) => setScreenMode(current, next));
  };

  /**
   * Начало и конец боя пересобирают список не меньше, чем смена режима, и так же снимают фильтры:
   * «Ритуал» после начала боя не нашёл бы ни строки, а переключателя, которым его снять, на экране
   * к этому времени нет.
   */
  const startFight = (): void => {
    if (apply((current) => startCombat(current, clock)) === null) setFilters(NO_FILTERS);
  };

  const finishFight = (): void => {
    if (apply((current) => endCombat(current, clock)) !== null) return;
    setFilters(NO_FILTERS);
    setFightOverOpen(false);
  };

  /** Подтверждение применения: одна транзакция, одна запись журнала. */
  const confirm = (confirmed: CastDraft): void => {
    const failure = apply((current) => castSpell(current, toCastRequest(confirmed), clock));
    if (failure === null) {
      draftStore.getState().cancel();
      setOpenSpellId(null);
    }
  };

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <ModeSwitcher mode={mode} onChange={changeMode} />

        {parts.resources ? (
          <ResourceHeader
            character={character}
            economy={economy}
            bookCastingTimes={dividing.castingTimes}
            onOpenHitPoints={() => setDamageOpen(true)}
            onEditResources={() => setResourcesOpen(true)}
          />
        ) : null}

        {parts.effects ? (
          <ActiveEffects
            character={character}
            concentration={concentrationSummary}
            onOpenConcentration={() => setPanelOpen(true)}
            onEndEffect={(effectId) => apply((current) => endEffect(current, effectId, clock))}
          />
        ) : null}

        {/*
         * Ряда нет, когда в нём нечему стоять: в «Журнале» ни счётчика подготовки, ни кнопок, а
         * пустая обёртка всё равно забрала бы промежуток родителя — 8 пикселей, которых на
         * iPhone SE не бывает лишних.
         */}
        {parts.preparation || parts.encounter || parts.reactions ? (
          <div className="flex flex-wrap items-center gap-2">
            {/*
             * Счётчик подготовки: лимит — единственное жёсткое ограничение приложения, и
             * двенадцатое заклинание обязано упираться в видимое число, а не во внезапный отказ.
             * Стоит в ряду кнопок, а не отдельной строкой: отдельная строка стоила бы ряда, а на
             * iPhone SE ряд — это пятая часть карточки.
             */}
            {parts.preparation ? (
              <p
                aria-label={`Подготовлено ${character.preparedSpellIds.length} из ${limit}`}
                className={`flex-1 text-xs tabular-nums ${
                  character.preparedSpellIds.length >= limit
                    ? "font-medium text-reaction-strong dark:text-reaction"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {character.preparedSpellIds.length} из {limit}
              </p>
            ) : null}
            {/*
             * Отметки схватки стоят рядом, потому что это три решения одной ситуации: начал,
             * сходил, закончил. Без явного начала приложение не знает, где кончился прежний бой, и
             * следующий открывался бы шестым раундом; без явного конца счёт раундов не обнулить.
             *
             * «Новый ход» появляется вместе с боем и уходит вместе с ним: вне боя ходов нет, и
             * кнопка отвечала бы на вопрос, которого не задают.
             */}
            {parts.encounter ? (
              <>
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
              </>
            ) : null}
            {/*
             * Реакции — отдельный вход, видимый независимо от фильтров и прокрутки списка: триггер
             * приходит в чужой ход, и искать заклинание по списку в этот момент некогда. В «Книге»
             * и «Журнале» кнопки нет: их открывают намеренно и ненадолго, а не держат открытыми в
             * чужой ход.
             */}
            {parts.reactions ? (
              <button
                type="button"
                onClick={() => setReactionsOpen(true)}
                className="min-h-11 grow whitespace-nowrap rounded-xl border border-reaction px-1 text-sm font-semibold text-reaction-strong dark:text-reaction"
              >
                Реакции
              </button>
            ) : null}
            {/*
             * Привал — кнопка, а не блок: отдых, восстановление и покупки вместе со списком и
             * фильтрами не помещаются на 320 × 568, а первая карточка списка обязана быть видна
             * целиком. Открывают его намеренно и ненадолго — как «Реакции».
             */}
            {parts.camp && !inFight ? (
              <button
                type="button"
                onClick={() => setCampOpen(true)}
                className="min-h-11 grow whitespace-nowrap rounded-xl border border-slate-300 px-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Привал
              </button>
            ) : null}
          </div>
        ) : null}

        {error === null ? null : (
          <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-xs">
            {error}{" "}
            <button
              type="button"
              onClick={() => sessionStore.getState().dismissError()}
              className="underline"
            >
              Понятно
            </button>
          </p>
        )}
      </div>

      {/*
       * Полоса фильтров жмётся по вертикали: каждые 8 пикселей здесь — восьмая часть карточки. В
       * «Бою» она закреплена: список просматривают под чужой ход, и уехавший за край переключатель —
       * переключатель, которого нет. Там, где списка нет, нет и её.
       */}
      {parts.spellList ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <SpellFilters
            filters={filters}
            dividing={dividing}
            mode={mode}
            onChange={setFilters}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {/*
         * Журнал занимает то же место, что и список: это и есть содержимое режима. Записи отдаются
         * в порядке хранения — переворачивает их сам компонент.
         */}
        {parts.sheet ? (
          <CharacterSheetScreen character={character} onEdit={setOpenBlockId} />
        ) : null}

        {parts.journal ? (
          <JournalScreen
            entries={session.journal}
            onUndo={() => apply(undoLast)}
            onData={() => setDataOpen(true)}
          />
        ) : null}

        {/*
         * Без этой проверки «Вне боя» и «Журнал» отвечали бы «под выбранные фильтры не подходит ни
         * одно заклинание» — сообщением о пустом результате там, где искать никто не начинал.
         */}
        {parts.spellList ? (
          <>
            {rows.length > 0 ? (
              <ul aria-label={listLabel} className="flex flex-col gap-2">
                {rows}
              </ul>
            ) : null}

            {/*
             * Пусто — только когда не подошло вообще ничего, включая «Магию крови». Кнопки сброса
             * рядом нет: полоса переключателей стоит на экране выше и не прокручивается, снять
             * выбранное — одно касание там же, где его поставили.
             */}
            {rows.length === 0 ? (
              <p className="text-sm">Под выбранные фильтры не подходит ни одно заклинание.</p>
            ) : null}
          </>
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

      {/*
       * Обмен идёт тем же мастером, что и заклинания. Хиты считаются здесь, а не в компоненте:
       * цена — правило ступени возвышения, и компонент её не выдумывает.
       */}
      {bloodOpen ? (
        <BloodMagicWizard
          character={character}
          economy={economy}
          error={error}
          onCancel={() => setBloodOpen(false)}
          onConfirm={(points, allowAnyway) => {
            const spent = points * ascensionTierRate(character.level);
            const failure = apply((current) =>
              exchangeBlood(current, spent, clock, { allowAnyway }),
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
            // Подтверждения нет: ошибка отменяется журналом.
            if (apply((current) => endConcentration(current, "manual", clock)) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}

      {/* Долгий отдых уничтожает состояние боя, поэтому спрашивается один раз. */}
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

      {/*
       * Восстановление предлагается, а не выполняется молча: половина максимума названа игроком,
       * но из документа расы не следует. Отказ ничего не меняет — бой продолжается.
       */}
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

      {dataOpen ? (
        <DataSheet
          exportText={JSON.stringify(exportSnapshot(character, spells, clock.now()), null, 2)}
          fileName={exportFileName(clock.now())}
          error={importError}
          catalogSource={catalogSource}
          onImport={(raw) => {
            const outcome = parseImport(raw);
            if (!outcome.ok) {
              setImportError(outcome.reasonRu);
              return;
            }
            // Персонаж и каталог заменяются одной записью: половины импорта не бывает.
            const failure = sessionStore.getState().importSnapshot(outcome.file);
            setImportError(failure);
            if (failure === null) setDataOpen(false);
          }}
          onRestoreBuiltInCatalog={() => {
            // Отказ оставляет каталог прежним и называет карточку, которой в сборке нет.
            setImportError(sessionStore.getState().restoreBuiltInCatalog());
          }}
          onClose={() => {
            setImportError(null);
            setDataOpen(false);
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
       * Привал закрывается вместе с начатой операцией: её итог — ячейки, хиты и руны — виден в
       * шапке, которую шторка закрывает собой. Список покупок закрытия не требует: он о том, что
       * лежит в сумке, а не о числах шапки.
       */}
      {campOpen ? (
        <CampSheet
          character={character}
          spells={spells}
          onShortRest={() => {
            if (apply((current) => shortRest(current, clock)) === null) setCampOpen(false);
          }}
          onLongRest={() => {
            setCampOpen(false);
            setLongRestOpen(true);
          }}
          onArcaneRecovery={() => {
            setCampOpen(false);
            setRecoveryOpen(true);
          }}
          onRecoverMaximum={() => {
            if (apply((current) => recoverHitPointMaximum(current, clock)) === null) {
              setCampOpen(false);
            }
          }}
          onToggleMaterial={(spellId) => apply((current) => toggleMaterial(current, spellId, clock))}
          onClose={() => setCampOpen(false)}
        />
      ) : null}

      {reactionsOpen ? (
        <ReactionsSheet
          spells={inMode}
          character={character}
          reactionAvailable={economy.reactionAvailable}
          runeAvailable={wardingSigilAvailable(character)}
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

      {/*
       * Шторки листа. Каждая закрывается только удавшейся правкой: отказ схемы оставляет введённое
       * на экране, иначе игрок терял бы набранное вместе с сообщением об ошибке.
       */}
      {openBlockId === "identity" ? (
        <IdentitySheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(patch) => {
            if (apply((current) => editIdentity(current, patch)) === null) setOpenBlockId(null);
          }}
        />
      ) : null}

      {openBlockId === "level" ? (
        <LevelSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(next) => {
            if (apply((current) => changeLevel(current, next, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {editedAbility === null ? null : (
        <AbilitySheet
          ability={editedAbility}
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(change) => {
            if (apply((current) => editAbility(current, change, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      )}

      {openBlockId === "itemBonuses" ? (
        <ItemBonusesSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(otherBonuses) => {
            if (apply((current) => editOtherBonuses(current, otherBonuses, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "health" ? (
        <HealthSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(change) => {
            if (apply((current) => editHealth(current, change, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "armorClassBase" ? (
        <ArmorSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(base) => {
            if (apply((current) => editArmorClassBase(current, base, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {/* Инвентарь остаётся открытым: вещи заводят пачкой, и закрытие после каждой мешало бы. */}
      {openBlockId === "inventory" ? (
        <InventorySheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onAdd={(item) => apply((current) => addItem(current, item, clock))}
          onRemove={(id) => apply((current) => removeItem(current, id, clock))}
          onToggleWorn={(id) => apply((current) => toggleWorn(current, id, clock))}
        />
      ) : null}

      {openBlockId === "marks" ? (
        <MarksSheet
          character={character}
          onCancel={() => setOpenBlockId(null)}
          onSave={(marks) => {
            if (apply((current) => editMarks(current, marks, clock)) === null) {
              setOpenBlockId(null);
            }
          }}
        />
      ) : null}

      {openBlockId === "combatNumbers" && openOverrideId === null ? (
        <OverridePickerSheet
          numbers={derivedNumbers}
          onCancel={() => setOpenBlockId(null)}
          onPick={setOpenOverrideId}
        />
      ) : null}

      {openOverrideId === null ? null : (
        <OverrideSheet
          id={openOverrideId}
          formulaValue={formulaNumbers[openOverrideId]}
          currentValue={derivedNumbers.find((number) => number.id === openOverrideId)?.value ?? 0}
          onCancel={() => setOpenOverrideId(null)}
          onSave={(value) => {
            if (apply((current) => setOverride(current, openOverrideId, value, clock)) === null) {
              setOpenOverrideId(null);
              setOpenBlockId(null);
            }
          }}
        />
      )}

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
          runeAvailable={wardingSigilAvailable(character)}
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
    </main>
  );
}
