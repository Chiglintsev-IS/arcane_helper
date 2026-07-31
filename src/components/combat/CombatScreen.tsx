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

import { CastWizard } from "@/components/cast/CastWizard";
import { ResourceHeader } from "@/components/combat/ResourceHeader";
import { SpellFilters } from "@/components/combat/SpellFilters";
import { SpellCardCompact } from "@/components/spell/SpellCardCompact";
import { SpellCardDetails } from "@/components/spell/SpellCardDetails";
import { loadThorneSpells } from "@/data/content/thorne";
import { bestCastPlan, countHiddenRituals, filterSpells, NO_FILTERS } from "@/rules/filters";
import { toCastRequest, type CastDraft } from "@/store/castDraftStore";
import { useDraft, useSession, useStores } from "@/store/provider";
import {
  beginTurn,
  castSpell,
  deriveTurnEconomy,
  setSpellNote,
  setTurnTracking,
  undoLast,
} from "@/store/session";

/** Контент разбирается схемой один раз на модуль: карточки в бою не меняются. */
const SPELLS = loadThorneSpells();

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

  const economy = useMemo(
    () => (session === null ? null : deriveTurnEconomy(session)),
    [session],
  );

  if (status === "loading" || session === null || economy === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-sm text-slate-500">
        {status === "error" ? (error ?? "Состояние не прочитано") : "Загрузка состояния…"}
      </main>
    );
  }

  const { character } = session;
  const context = { character, turn: economy };
  const shown = filterSpells(SPELLS, filters, context);
  const hiddenRituals = countHiddenRituals(SPELLS, filters, context);
  const openSpell = SPELLS.find((spell) => spell.id === openSpellId) ?? null;
  const levels = [...new Set(SPELLS.map((spell) => spell.level))].sort((a, b) => a - b);
  const lastEntry = session.journal.at(-1);

  const apply = sessionStore.getState().apply;

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
        <ResourceHeader character={character} economy={economy} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => apply((current) => beginTurn(current, clock))}
            className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold leading-tight text-white"
          >
            Мой ход начался
          </button>
          <button
            type="button"
            disabled={lastEntry === undefined}
            onClick={() => apply(undoLast)}
            title={lastEntry?.summaryRu}
            aria-label={
              lastEntry === undefined ? "Отменить" : `Отменить: ${lastEntry.summaryRu}`
            }
            className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50 dark:border-slate-800"
          >
            Отменить
          </button>
          <button
            type="button"
            aria-pressed={character.turnTracking.enabled}
            onClick={() =>
              apply((current) => setTurnTracking(current, !character.turnTracking.enabled, clock))
            }
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-xl border px-3 text-xs ${
              character.turnTracking.enabled
                ? "border-action text-action-strong dark:text-action"
                : "border-slate-200 text-slate-500 dark:border-slate-800"
            }`}
          >
            Учёт хода
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

      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <SpellFilters
          filters={filters}
          availableLevels={levels}
          onChange={setFilters}
          onReset={() => setFilters(NO_FILTERS)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {shown.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p>
              Под выбранные фильтры не подходит ни одно заклинание
              {hiddenRituals > 0
                ? `, а ещё ${hiddenRituals} ритуалов скрыты как неподготовленные`
                : ""}
              .
            </p>
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-slate-800"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <ul aria-label="Заклинания" className="flex flex-col gap-2">
            {shown.map((spell) => (
              <SpellCardCompact
                key={spell.id}
                spell={spell}
                character={character}
                unavailableReason={firstReason(spell, character, economy)}
                onOpen={() => setOpenSpellId(spell.id)}
              />
            ))}
          </ul>
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

      <CastWizard character={character} economy={economy} onConfirm={confirm} error={error} />
    </main>
  );
}
