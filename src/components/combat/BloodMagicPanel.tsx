/**
 * Кровавое колдовство и хиты (F-15, F-16).
 *
 * Здесь видно, куда уходит здоровье и как оно возвращается: обмен снижает и текущие хиты, и максимум,
 * а обратно поднимается только максимум — по три за полный час без солнца и без огня
 * ([FR-172](../../../docs/features/F-15-blood-magic.md#fr-172),
 * [FR-173](../../../docs/features/F-15-blood-magic.md#fr-173)). Лечение поднимает текущие хиты, но
 * упереться им можно только в снижённый максимум, поэтому снижение показано отдельной строкой.
 *
 * Часы отмечает игрок: таймеров в MVP нет ([F-08](../../../docs/features/F-08-active-effects.md)).
 */

"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
import {
  bloodMagicAvailable,
  exchangeForSpellLevel,
  MAXIMUM_PAYABLE_SPELL_LEVEL,
  maximumRecoveryPerHour,
  spellPointCost,
  woundsFromExchange,
} from "@/rules/bloodMagic";
import { withPlural } from "@/rules/language";

export type BloodMagicActions = {
  /** Обмен хитов на очки заклинаний: действие в свой ход (FR-170). */
  onExchange: (hitPoints: number) => void;
  onDamage: (damage: number, fire: boolean) => void;
  onRecoverMaximum: () => void;
  onSunlight: (underSunlight: boolean) => void;
  onClose: () => void;
};

/** Уровни, которые вообще оплачиваются кровью и доступны персонажу. */
function payableLevels(character: CharacterState): number[] {
  return Object.keys(character.spellSlots)
    .map(Number)
    .filter((level) => level <= MAXIMUM_PAYABLE_SPELL_LEVEL)
    .sort((left, right) => left - right);
}

export function BloodMagicPanel({
  character,
  actions,
}: {
  character: CharacterState;
  actions: BloodMagicActions;
}) {
  const [damage, setDamage] = useState("");
  const [fire, setFire] = useState(false);

  const available = bloodMagicAvailable(character.suppression);
  const { hitPoints } = character;
  const parsedDamage = Number.parseInt(damage, 10);
  const damageValid = Number.isInteger(parsedDamage) && parsedDamage > 0;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Кровь и хиты"
      className="fixed inset-0 z-10 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Кровь и хиты</h2>
          <p className="text-xs text-slate-500">
            {hitPoints.current} из {hitPoints.maximum}
            {hitPoints.maximumReduction > 0
              ? ` · максимум снижен на ${hitPoints.maximumReduction}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={actions.onClose}
          className="px-2 text-sm text-slate-500 underline"
        >
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        <section aria-label="Состояние" className="flex flex-wrap gap-1">
          <Badge tone="muted" icon="✚">
            Очки заклинаний {character.spellPoints.remaining}
          </Badge>
          {hitPoints.maximumReduction > 0 ? (
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {hitPoints.maximumReduction}
            </Badge>
          ) : null}
          {available ? null : (
            <Badge tone="muted" icon="✗">
              {character.suppression.firedUpon
                ? "Подавлено уроном огнём до конца следующего хода"
                : "Подавлено прямым солнечным светом"}
            </Badge>
          )}
        </section>

        <section aria-label="Обмен хитов на очки" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Обменять хиты на очки
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Обмен тратит действие в свой ход. Хиты уходят и из текущих, и из максимума; максимум
            возвращается по {maximumRecoveryPerHour(character.level)} за полный час.
          </p>
          <ul className="flex flex-col gap-1">
            {payableLevels(character).map((level) => {
              const exchange = exchangeForSpellLevel(level, character.level);
              const toZero = exchange.hitPointsSpent >= hitPoints.current;
              return (
                <li key={level}>
                  <button
                    type="button"
                    onClick={() => actions.onExchange(exchange.hitPointsSpent)}
                    className="flex min-h-11 w-full flex-col items-start rounded-lg border border-slate-200 px-3 py-1 text-left dark:border-slate-800"
                  >
                    <span>
                      Ячейка {level} уровня — {withPlural(exchange.hitPointsSpent, ["хит", "хита", "хитов"])}{" "}
                      за {withPlural(spellPointCost(level), ["очко", "очка", "очков"])}
                    </span>
                    {toZero ? (
                      <span className="text-xs font-medium text-reaction-strong dark:text-reaction">
                        Уйдёт в ноль хитов: {withPlural(
                          woundsFromExchange(exchange.pointsCreated),
                          ["рана", "раны", "ран"],
                        )}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Полученный урон" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Получен урон
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="text-slate-600 dark:text-slate-400">Сколько</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={damage}
                onChange={(event) => setDamage(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-base dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
            <label className="flex min-h-11 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={fire}
                onChange={(event) => setFire(event.target.checked)}
                className="size-5"
              />
              Огнём
            </label>
          </div>
          <button
            type="button"
            disabled={!damageValid}
            onClick={() => {
              actions.onDamage(parsedDamage, fire);
              setDamage("");
              setFire(false);
            }}
            className="min-h-11 rounded-lg border border-slate-200 px-3 disabled:opacity-50 dark:border-slate-800"
          >
            Отметить урон
          </button>
          <p className="text-xs text-slate-500">
            Урон огнём подавляет расовые особенности до конца следующего хода: ни регенерации, ни
            обмена, ни восстановления максимума.
          </p>
        </section>

        <section aria-label="Восстановление" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Восстановление максимума
          </h3>
          <button
            type="button"
            disabled={hitPoints.maximumReduction <= 0 || !available}
            onClick={actions.onRecoverMaximum}
            className="min-h-11 rounded-lg border border-slate-200 px-3 disabled:opacity-50 dark:border-slate-800"
          >
            Прошёл час
          </button>
          {hitPoints.maximumReduction <= 0 ? (
            <p className="text-xs text-slate-500">Максимум не снижен — восстанавливать нечего.</p>
          ) : null}
          <button
            type="button"
            aria-pressed={character.suppression.underDirectSunlight}
            onClick={() => actions.onSunlight(!character.suppression.underDirectSunlight)}
            className={`min-h-11 rounded-lg border px-3 text-xs ${
              character.suppression.underDirectSunlight
                ? "border-bonus text-bonus-strong dark:text-bonus"
                : "border-slate-200 text-slate-500 dark:border-slate-800"
            }`}
          >
            Под прямым солнечным светом
          </button>
        </section>
      </div>
    </section>
  );
}
