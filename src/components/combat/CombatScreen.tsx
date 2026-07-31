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
import { BloodMagicPanel } from "@/components/combat/BloodMagicPanel";
import { BloodMagicRow } from "@/components/combat/BloodMagicRow";
import { CampActions } from "@/components/combat/CampActions";
import { CastWizard } from "@/components/cast/CastWizard";
import { ConfirmSheet } from "@/components/combat/ConfirmSheet";
import { ConcentrationCheckCard } from "@/components/combat/ConcentrationCheckCard";
import { ConcentrationPanel } from "@/components/combat/ConcentrationPanel";
import { ModeSwitcher } from "@/components/combat/ModeSwitcher";
import { ReactionsSheet } from "@/components/combat/ReactionsSheet";
import { ResourceHeader } from "@/components/combat/ResourceHeader";
import { SpellFilters, type AvailableFilters } from "@/components/combat/SpellFilters";
import { SpellCardCompact } from "@/components/spell/SpellCardCompact";
import { SpellCardDetails } from "@/components/spell/SpellCardDetails";
import { BANNED_SPELLS, loadThorneSpells } from "@/data/content/thorne";
import { HitPointsSheet } from "@/components/combat/HitPointsSheet";
import {
  describeConcentration,
  describeConcentrationCheck,
  type ConcentrationCheck,
} from "@/rules/concentration";
import { BLOOD_MAGIC_TRAITS } from "@/rules/bloodMagic";
import { preparedLimit } from "@/rules/abilities";
import { rolesPresent } from "@/rules/combatRole";
import { findBan, matchesQuery } from "@/rules/restrictions";
import {
  bestCastPlan,
  filterSpells,
  matchesTraits,
  traitsOf,
  NO_FILTERS,
} from "@/rules/filters";
import { compareCombatTraits, spellsForScreen, type ScreenMode } from "@/rules/modes";
import { toCastRequest, type CastDraft } from "@/store/castDraftStore";
import { useDraft, useSession, useStores } from "@/store/provider";
import {
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
  setScreenMode,
  setSpellNote,
  setSunlight,
  shortRest,
  spendRuneOnWardingSigil,
  takeDamage,
  togglePreparation,
  undoLast,
  useArcaneRecovery,
  wardingSigilAvailable,
} from "@/store/session";

/** Контент разбирается схемой один раз на модуль: карточки в бою не меняются. */
const SPELLS = loadThorneSpells();

/**
 * Что встречается в переданном списке.
 *
 * Переключатели и значки строятся отсюда, а не из списка всех мыслимых значений: элемент, за которым
 * нет ни одного заклинания, обещает возможность, которой нет (FR-001, FR-002). Считается от списка
 * режима, а не от всей книги, — иначе в бою предлагался бы фильтр «Ритуал», за которым в этом
 * режиме ничего не стоит.
 */
function availableFilters(spells: readonly (typeof SPELLS)[number][]): AvailableFilters {
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
  spell: (typeof SPELLS)[number],
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

  const [filters, setFilters] = useState(NO_FILTERS);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [longRestOpen, setLongRestOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [fightOverOpen, setFightOverOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [query, setQuery] = useState("");
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
      spell: SPELLS.find((candidate) => candidate.id === effect.spellId) ?? null,
      effect,
      character: session.character,
      journal: session.journal,
    });
  }, [session]);

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
  const inMode = spellsForScreen(SPELLS, character);
  // Поиск живёт в «Книге»: там 29 карточек и вопрос «где оно» настоящий. В бою и на привале список
  // короткий, и поле ввода забрало бы ряд ради задачи, которой нет (FR-162).
  const searched = inMode.filter((spell) => matchesQuery(spell, query));
  const shown = filterSpells(searched, filters, context);
  const available = availableFilters(inMode);
  // «Магия крови» — конкурент за то же действие и потому подчиняется тем же фильтрам (FR-207).
  const bloodShown =
    character.screenMode === "combat" && matchesTraits(BLOOD_MAGIC_TRAITS, filters);

  /**
   * Один список, а не два (FR-207, FR-210). Обмен хитов на очки ячейку не тратит, значит по цене он
   * стоит там же, где заговоры, и идёт сразу за ними. Отдельным списком он оказывался бы или выше
   * реакций, или ниже всего — в обоих случаях не на своём месте, а порядок здесь и есть подсказка.
   */
  // Подготовка живёт в «Книге» (FR-214): в бою состав уже определён, и менять его под чужой ход
  // приложение предлагать не должно.
  const preparing = character.screenMode === "book";
  const limit = preparedLimit(character.intelligence, character.level);
  const ban = findBan(query, BANNED_SPELLS);

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
    const after = shown.findIndex(
      (spell) => compareCombatTraits(traitsOf(spell), BLOOD_MAGIC_TRAITS) > 0,
    );
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
  const openSpell = SPELLS.find((spell) => spell.id === openSpellId) ?? null;
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
   * Режим переключается сразу и без условий: игрок мог уйти в книгу за справкой посреди боя. Вопрос
   * задаётся только на выходе из боя и только когда ответ «да» что-то изменит, — при полном
   * здоровье он предлагал бы восстановить нечего.
   */
  const changeMode = (mode: ScreenMode): void => {
    const leavingFight = character.screenMode === "combat" && mode !== "combat";
    // Наборы фильтров у режимов разные, и выбранное в одном становится в другом невидимым:
    // «Ритуал» с привала молча сузил бы боевой список до пустого, а переключателя, которым это
    // снять, на экране уже нет (FR-212).
    setFilters(NO_FILTERS);
    setQuery("");
    apply((current) => setScreenMode(current, mode));
    if (leavingFight && combatEndRecovery(character) > 0) setFightOverOpen(true);
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
          showResources={!preparing}
          onOpenHitPoints={() => setDamageOpen(true)}
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
              className={`flex-1 text-xs tabular-nums ${
                character.preparedSpellIds.length >= limit
                  ? "font-medium text-reaction-strong dark:text-reaction"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Подготовлено {character.preparedSpellIds.length} из {limit}
            </p>
          ) : null}
          {/* Ход начинается только в бою: вне боя ходов нет, и кнопка звала бы начать то, чего не происходит (FR-202). */}
          {character.screenMode === "combat" ? (
            <>
              <button
                type="button"
                onClick={() => apply((current) => beginTurn(current, clock))}
                className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold leading-tight text-white"
              >
                Мой ход начался
              </button>
              {/*
                Реакции — отдельный вход, видимый независимо от фильтров и прокрутки списка
                (FR-060): триггер приходит в чужой ход, и искать заклинание по списку в этот момент
                некогда.
              */}
              <button
                type="button"
                onClick={() => setReactionsOpen(true)}
                className="min-h-11 shrink-0 rounded-xl border border-reaction px-3 text-sm font-semibold text-reaction-strong dark:text-reaction"
              >
                Реакции
              </button>
            </>
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
        На привале её нет вовсе: список там из пяти строк, отобранных самим режимом, и полоса выше
        карточки над таким списком — чистая потеря (FR-202).
      */}
      {character.screenMode === "camp" ? null : (
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          {preparing ? (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск по названию"
              placeholder="Поиск по названию"
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            />
          ) : null}
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
        {rows.length > 0 ? (
          <ul aria-label={listLabel} className="flex flex-col gap-2">
            {rows}
          </ul>
        ) : null}

        {/* Пусто — только когда не подошло вообще ничего, включая «Магию крови». */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            {/*
              Пустой результат поиска читается как потеря данных или поломка. Если искали
              запрещённое, приложение отвечает причиной — «Понимание языков запрещено мастером», —
              а не молчанием (FR-162).
            */}
            {ban === null ? (
              <p>
                {query.trim() === ""
                  ? "Под выбранные фильтры не подходит ни одно заклинание."
                  : `По запросу «${query.trim()}» ничего не найдено.`}
              </p>
            ) : (
              <p role="status">
                <span className="font-medium">{ban.nameRu}</span> ({ban.nameEn}) —{" "}
                {ban.explanationRu}
              </p>
            )}
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-slate-800"
            >
              Сбросить фильтры
            </button>
          </div>
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
        <BloodMagicPanel
          character={character}
          actions={{
            onExchange: (hitPoints) => apply((current) => exchangeBlood(current, hitPoints, clock)),
            onDamage: recordDamage,
            onRecoverMaximum: () => apply((current) => recoverHitPointMaximum(current, clock)),
            onSunlight: (under) => apply((current) => setSunlight(current, under, clock)),
            onClose: () => setBloodOpen(false),
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
          body={`Регенерация вне боя идёт непрерывно: здоровье поднимется до половины максимума, это ${combatEndRecovery(character)} хитов.`}
          confirmLabel="Да, бой закончен"
          cancelLabel="Нет, продолжается"
          onConfirm={() => {
            if (apply((current) => endCombat(current, clock)) === null) setFightOverOpen(false);
          }}
          onCancel={() => setFightOverOpen(false)}
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
