/**
 * Экран боя (F-01) — единственная точка входа во время игры.
 *
 * Порядок сверху вниз задан ux.md#иерархия-экрана-боя: ресурсы, концентрация и эффекты, фильтры,
 * прокручиваемый список заклинаний. Шапка не прокручивается: она отвечает на вопросы, которые
 * возникают чаще всего.
 *
 * Единственная точка изменения состояния персонажа — `apply` (ADR-0003, ADR-0006). Компоненты списка
 * и карточки состояние не трогают: они сообщают о нажатии, а операцию выбирает этот экран.
 */

"use client";

import { useMemo, useState } from "react";

import { ArcaneRecoverySheet } from "@/components/combat/ArcaneRecoverySheet";
import { BloodMagicWizard } from "@/components/cast/BloodMagicWizard";
import { BloodMagicRow } from "@/components/combat/BloodMagicRow";
import { CampActions } from "@/components/combat/CampActions";
import { MaterialsList } from "@/components/combat/MaterialsList";
import { CastWizard } from "@/components/cast/CastWizard";
import { ConfirmSheet } from "@/components/combat/ConfirmSheet";
import { DataSheet } from "@/components/combat/DataSheet";
import { ConcentrationCheckCard } from "@/components/combat/ConcentrationCheckCard";
import { ConcentrationPanel } from "@/components/combat/ConcentrationPanel";
import { ModeSwitcher } from "@/components/combat/ModeSwitcher";
import { ReactionsSheet } from "@/components/combat/ReactionsSheet";
import { ResourceHeader } from "@/components/combat/ResourceHeader";
import { ResourcesSheet } from "@/components/combat/ResourcesSheet";
import { SpellFilters, type AvailableFilters } from "@/components/combat/SpellFilters";
import { SpellCardCompact } from "@/components/spell/SpellCardCompact";
import { SpellCardDetails } from "@/components/spell/SpellCardDetails";
import type { Spell } from "@/data/schemas/spell";
import { HitPointsSheet } from "@/components/combat/HitPointsSheet";
import {
  describeConcentration,
  describeConcentrationCheck,
  type ConcentrationCheck,
} from "@/rules/concentration";
import { ascensionTierRate, BLOOD_MAGIC_TRAITS } from "@/rules/bloodMagic";
import { preparedLimit } from "@/rules/abilities";
import { rolesPresent } from "@/rules/combatRole";
import { exportFileName, exportSnapshot, parseImport } from "@/rules/dataIo";
import {
  bestCastPlan,
  filterSpells,
  matchesActionRow,
  traitsOf,
  NO_FILTERS,
} from "@/rules/filters";
import { compareCombatTraits, spellsForScreen, type ScreenMode } from "@/rules/modes";
import { toCastRequest, type CastDraft } from "@/store/castDraftStore";
import { useDraft, useSession, useStores } from "@/store/provider";
import {
  adjustRunes,
  beginTurn,
  castSpell,
  combatEndRecovery,
  deriveTurnEconomy,
  endCombat,
  endConcentration,
  endEffect,
  exchangeBlood,
  grantTemporaryHitPoints,
  heal,
  longRest,
  recoverHitPointMaximum,
  refundSpellSlot,
  setScreenMode,
  setSpellNote,
  setSunlight,
  startCombat,
  shortRest,
  spendRuneOnWardingSigil,
  spendSpellSlot,
  takeDamage,
  toggleMaterial,
  togglePreparation,
  undoLast,
  useArcaneRecovery,
  wardingSigilAvailable,
} from "@/store/session";

/**
 * Что встречается в переданном списке.
 *
 * Переключатели и значки строятся отсюда, а не из списка всех мыслимых значений: элемент, за которым
 * нет ни одного заклинания, обещает возможность, которой нет (FR-001, FR-002). Считается от списка
 * режима, а не от всей книги, — иначе в бою предлагался бы фильтр «Ритуал», за которым в этом
 * режиме ничего не стоит.
 */
function availableFilters(spells: readonly Spell[]): AvailableFilters {
  return {
    castingTimes: new Set(spells.map((spell) => spell.castingTime.type)),
    levels: [...new Set(spells.map((spell) => spell.level))].sort((a, b) => a - b),
    roles: rolesPresent(spells),
    concentration: spells.some((spell) => spell.concentration),
    ritual: spells.some((spell) => spell.ritual),
  };
}

/**
 * Первая причина, по которой заклинание сейчас не применить, — для строки списка.
 *
 * Причина берётся у лучшего способа сотворения, а не у первого попавшегося: строка обязана называть
 * то же, что скажет мастер применения (F-02, «Причина недоступности берётся у лучшего способа»).
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

export function CombatScreen() {
  const { clock, draft: draftStore, session: sessionStore } = useStores();
  const session = useSession((state) => state.session);
  const status = useSession((state) => state.status);
  const error = useSession((state) => state.error);
  const draft = useDraft((state) => state.draft);
  // Каталог — данные, а не константа модуля: импорт подменяет его целиком (FR-123).
  const spells = useSession((state) => state.spellCatalog);
  const catalogSource = useSession((state) => state.spellCatalogSource);

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [fightOverOpen, setFightOverOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingCheck, setPendingCheck] = useState<ConcentrationCheck | null>(null);

  const economy = useMemo(
    () => (session === null ? null : deriveTurnEconomy(session)),
    [session],
  );

  /**
   * Описание концентрации собирается из контента по `spellId` эффекта. Карточки может не быть —
   * состояние пришло импортом из другой сборки — тогда описание деградирует, но не исчезает:
   * концентрация не может уйти с экрана незаметно (F-07).
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
  // Режим отбирает раньше фильтров: фильтр сужает список внутри режима, режим задаёт сам список
  // (FR-200). Карточка открывается из всей книги — режим не должен закрывать уже открытое.
  const inMode = spellsForScreen(spells, character);
  // Поиск раньше жил в «Книге»: там 29 карточек и вопрос «где оно» настоящий. Игрок назвал поле
  // лишним для чтения и подготовки, и кнопку с полем убрали вовсе (FR-217) — список теперь строится
  // прямо из `inMode`, без промежуточного отбора по названию. Вместе с полем ушёл и единственный
  // вход к объяснению запрета мастера ([FR-162](../../docs/features/F-14-campaign-restrictions.md#fr-162));
  // куда оно переезжает — открытый вопрос ([OQ-34](../../docs/open-questions.md#oq-34)).
  const shown = filterSpells(inMode, filters, context);
  const available = availableFilters(inMode);
  // «Магия крови» — конкурент за то же действие и потому подчиняется тем же фильтрам (FR-207).
  // Она стоит и в «Книге»: очки заклинаний покупают вне боя, а «Книга» — единственный вход к
  // заклинаниям вне боя (FR-203). Во «Вне боя» её нет, потому что списка там нет вовсе (FR-202).
  // Поиску она раньше отвечала тоже (FR-162): запрос «дракон» в «Книге» не находил бы строку,
  // которая явно не подходит. С уходом поля поиска (FR-217) отбирать по названию стало нечем —
  // проверка снята как недостижимая, а не забыта.
  const bloodShown =
    character.screenMode !== "camp" && matchesActionRow(BLOOD_MAGIC_TRAITS, filters);

  /**
   * Один список, а не два (FR-207, FR-210). Обмен хитов на очки ячейку не тратит, значит по цене он
   * стоит там же, где заговоры, и идёт сразу за ними. Отдельным списком он оказывался бы или выше
   * реакций, или ниже всего — в обоих случаях не на своём месте, а порядок здесь и есть подсказка.
   */
  // Подготовка живёт в «Книге» (FR-214): в бою состав уже определён, и менять его под чужой ход
  // приложение предлагать не должно.
  const preparing = character.screenMode === "book";
  const limit = preparedLimit(character.intelligence, character.level);

  const rows = shown.map((spell) => (
    <SpellCardCompact
      key={spell.id}
      spell={spell}
      character={character}
      unavailableReason={firstReason(spell, character, economy)}
      onOpen={() => setOpenSpellId(spell.id)}
      onTogglePrepared={
        preparing
          ? () => apply((current) => togglePreparation(current, spell, limit, clock))
          : undefined
      }
    />
  ));
  if (bloodShown) {
    // Позиция ищется по-разному, потому что «Бой» и «Книга» сортированы по-разному. В «Бою» список
    // уже переставлен `orderForCombat` по тому же ключу `compareCombatTraits` — реакции вынесены
    // вперёд, — и искать по нему корректно: реакция уровня выше нуля всё равно упорядочена раньше
    // «Магии крови». В «Книге» список идёт «уровень, затем алфавит» без такой перестановки, и та же
    // проверка нашла бы «Щит» (реакция первого уровня) раньше заговоров только потому, что он
    // реакция, — а этот список реакции вперёд не выносит. Проверка по одному уровню верна для обоих
    // случаев здесь, потому что содержимое отсортировано по уровню в обоих списках.
    const after =
      character.screenMode === "combat"
        ? shown.findIndex((spell) => compareCombatTraits(traitsOf(spell), BLOOD_MAGIC_TRAITS) > 0)
        : shown.findIndex((spell) => traitsOf(spell).level > BLOOD_MAGIC_TRAITS.level);
    rows.splice(after === -1 ? rows.length : after, 0, (
      <BloodMagicRow
        key="blood-magic"
        character={character}
        economy={economy}
        onOpen={() => setBloodOpen(true)}
      />
    ));
  }
  // Имя списка называет то, что в нём есть: вне боя — только заклинания, в бою ещё и «Магия крови».
  const listLabel = bloodShown ? "Заклинания и действия" : "Заклинания";
  const openSpell = spells.find((candidate) => candidate.id === openSpellId) ?? null;
  const lastEntry = session.journal.at(-1);

  /**
   * Урон из любой точки ввода: хиты списываются, и при активной концентрации сразу предлагается
   * проверка (FR-083).
   *
   * Обработчик один на все точки ввода намеренно: вторая реализация рано или поздно забыла бы
   * предложить проверку, а незаметно потерять концентрацию нельзя (F-07). Обмен хитов на очки сюда
   * не идёт — это не урон и проверки не требует (FR-174).
   */
  const recordDamage = (damage: number, fire: boolean): void => {
    if (apply((current) => takeDamage(current, damage, clock, { fire })) !== null) return;
    setDamageOpen(false);
    setPanelOpen(false);
    if (character.concentration !== undefined) {
      setPendingCheck(describeConcentrationCheck(damage, character.constitutionSaveModifier));
    }
  };

  /**
   * Смена режима (FR-204) и вопрос о конце боя (FR-216).
   *
   * Режим переключается сразу и ничего не спрашивает: игрок мог уйти в книгу за справкой посреди
   * боя, и вопрос «бой закончен?» на каждый такой взгляд — шум. Конец боя отмечается явной кнопкой
   * в режиме «Вне боя» (FR-216), а начало — кнопкой в бою (FR-140).
   */
  const changeMode = (mode: ScreenMode): void => {
    // Наборы фильтров у режимов разные, и выбранное в одном становится в другом невидимым:
    // «Ритуал» с привала молча сузил бы боевой список до пустого, а переключателя, которым это
    // снять, на экране уже нет (FR-212).
    setFilters(NO_FILTERS);
    apply((current) => setScreenMode(current, mode));
  };

  /** Подтверждение применения: одна транзакция, одна запись журнала (FR-023). */
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
        <ModeSwitcher mode={character.screenMode} onChange={changeMode} />

        <ResourceHeader
          character={character}
          economy={economy}
          concentration={concentrationSummary}
          bookCastingTimes={available.castingTimes}
          onOpenHitPoints={() => setDamageOpen(true)}
          onEditResources={() => setResourcesOpen(true)}
          onOpenConcentration={() => setPanelOpen(true)}
          onEndEffect={(effectId) => apply((current) => endEffect(current, effectId, clock))}
        />

        {/*
          Операции привала — только на привале (FR-202, FR-215). В книге их нет: там читают и
          готовятся, а отдыхают на привале, и кнопка отдыха посреди чтения предлагала бы восемь
          часов случайным нажатием.
        */}
        {character.screenMode === "camp" ? (
          <CampActions
            character={character}
            onShortRest={() => apply((current) => shortRest(current, clock))}
            onLongRest={() => setLongRestOpen(true)}
            onArcaneRecovery={() => setRecoveryOpen(true)}
            onRecoverMaximum={() => apply((current) => recoverHitPointMaximum(current, clock))}
            inFight={economy.inFight}
            onFightOver={() => setFightOverOpen(true)}
            onData={() => setDataOpen(true)}
          />
        ) : null}
        {/*
          Список покупок живёт вне боя: докупают между сессиями, а не под чужой ход (FR-030).
        */}
        {character.screenMode === "camp" ? (
          <MaterialsList
            spells={spells}
            character={character}
            onToggle={(spellId) => apply((current) => toggleMaterial(current, spellId, clock))}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {/*
            Счётчик подготовки (FR-101): лимит — единственное жёсткое ограничение приложения, и
            двенадцатое заклинание обязано упираться в видимое число, а не во внезапный отказ.
            Стоит в ряду кнопок, а не отдельной строкой: отдельная строка стоила ряда, а на iPhone SE
            ряд — это пятая часть карточки.
          */}
          {preparing ? (
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
          {/* Ход начинается только в бою: вне боя ходов нет, и кнопка звала бы начать то, чего не происходит (FR-202). */}
          {character.screenMode === "combat" ? (
            <>
              {/*
                Бой начинается явно (FR-140). Пока он не начат, кнопка предлагает начать: это же и
                первый ход. Дальше она называет то, что делает каждый следующий раз, — «Мой ход».
                Без явного начала приложение не знает, где кончился прежний бой, и следующий
                открывался шестым раундом.
              */}
              <button
                type="button"
                onClick={() =>
                  apply((current) =>
                    economy.inFight ? beginTurn(current, clock) : startCombat(current, clock),
                  )
                }
                className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold leading-tight text-white"
              >
                {economy.inFight ? "Мой ход" : "Начать бой"}
              </button>
            </>
          ) : null}
          {/*
            Реакции — отдельный вход, видимый независимо от фильтров и прокрутки списка (FR-060):
            триггер приходит в чужой ход, и искать заклинание по списку в этот момент некогда.

            Кнопка стояла во всех трёх режимах, включая «Книгу» (FR-153): провалить спасбросок
            Ловкости или Телосложения можно и от ловушки в коридоре, а руна превращает провал в
            успех независимо от того, идёт ли бой. Довод не отменяется — в «Бою» и «Вне боя» кнопка
            стоит по нему же, — но «Книгу» открывают заранее, готовясь или читая, а не в чужой ход:
            там кнопка только забирала ряд у того, чем в книге пользуются (FR-217). Состав листа
            по-прежнему задаёт режим: во «Вне боя» списка заклинаний нет, и в листе остаются одни
            «Знаки ограждения».
          */}
          {character.screenMode !== "book" ? (
            <button
              type="button"
              onClick={() => setReactionsOpen(true)}
              className="min-h-11 shrink-0 rounded-xl border border-reaction px-3 text-sm font-semibold text-reaction-strong dark:text-reaction"
            >
              Реакции
            </button>
          ) : null}
          <button
            type="button"
            disabled={lastEntry === undefined}
            onClick={() => apply(undoLast)}
            title={lastEntry?.summaryRu}
            aria-label={
              lastEntry === undefined ? "Отменить" : `Отменить: ${lastEntry.summaryRu}`
            }
            className={`min-h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50 dark:border-slate-800 ${
              preparing ? "shrink-0" : "grow"
            }`}
          >
            Отменить
          </button>
        </div>

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
        Полоса фильтров жмётся по вертикали: каждые 8 пикселей здесь — это восьмая часть карточки.
        В «Бою» она закреплена: список просматривают под чужой ход, и уехавший за край переключатель —
        переключатель, которого нет. Вне боя её нет вовсе: списка там тоже нет (FR-202).
      */}
      {character.screenMode === "camp" ? null : (
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <SpellFilters
            filters={filters}
            available={available}
            mode={character.screenMode}
            onChange={setFilters}
            onReset={() => setFilters(NO_FILTERS)}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">

        {/*
          «Вне боя» списка заклинаний не показывает вовсе (FR-202): читать книгу игрок идёт в
          «Книгу», а здесь работают отдых, восстановление и подготовка. Без этой проверки режим
          отвечал бы «под выбранные фильтры не подходит ни одно заклинание» — сообщением о пустом
          результате там, где искать никто не начинал.
        */}
        {character.screenMode === "camp" ? null : (
          <>
            {rows.length > 0 ? (
              <ul aria-label={listLabel} className="flex flex-col gap-2">
                {rows}
              </ul>
            ) : null}

            {/* Пусто — только когда не подошло вообще ничего, включая «Магию крови». */}
            {rows.length === 0 ? (
              <div className="flex flex-col items-start gap-2 text-sm">
                {/*
                  Раньше здесь же отвечали на пустой результат поиска запрещённого — причиной
                  вместо молчания, беря её из `findBan(query, BANNED_SPELLS)` (FR-162). С уходом
                  поля поиска (FR-217) `query` всегда пуст, `findBan` на нём всегда молчит, и эта
                  ветка стала недостижима — снята вместе с полем, а не оставлена мёртвой. Куда
                  переезжает объяснение запрета — открытый вопрос (OQ-34); сама функция `findBan` не
                  удалена и ждёт нового входа.
                */}
                <p>Под выбранные фильтры не подходит ни одно заклинание.</p>
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-slate-800"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : null}
          </>
        )}
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
        Обмен идёт тем же мастером, что и заклинания (FR-177). Хиты считаются здесь, а не в
        компоненте: цена — правило ступени возвышения, и компонент её не выдумывает.
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
            // Подтверждения нет: ошибка отменяется журналом (FR-111, ux.md).
            if (apply((current) => endConcentration(current, "manual", clock)) === null) {
              setPanelOpen(false);
            }
          }}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}

      {/* Долгий отдых уничтожает состояние боя, поэтому спрашивается один раз (FR-133). */}
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
        Восстановление предлагается, а не выполняется молча: половина максимума названа игроком, но
        из документа расы не следует (OQ-15, пункт 6). Отказ ничего не меняет — бой продолжается.
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
          onConfirm={() => {
            if (apply((current) => endCombat(current, clock)) === null) setFightOverOpen(false);
          }}
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
            // Персонаж и каталог заменяются одной записью: половины импорта не бывает (FR-122).
            const failure = sessionStore.getState().importSnapshot(outcome.file);
            setImportError(failure);
            if (failure === null) setDataOpen(false);
          }}
          onRestoreBuiltInCatalog={() => {
            // Отказ оставляет каталог прежним и называет карточку, которой в сборке нет (FR-123).
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
