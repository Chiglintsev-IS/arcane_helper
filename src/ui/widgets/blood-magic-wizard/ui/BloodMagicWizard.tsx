/** Состояние персонажа отсюда менять нечем: его меняет только `onConfirm` из кнопки подтверждения. */

"use client";

import type { TurnEconomy } from "@/core/application/useCases/turn";
import { useState } from "react";

import { WizardShell } from "@/ui/shared/ui/WizardShell";
import type { CharacterState } from "@/core/domain/assembly/state";
import { bloodExchangeAnnouncement, bloodExchangeInstructions } from "@/core/application/casting/announcement";
import { ACTION_SPENT_MESSAGES } from "@/core/application/casting/availability";
import { ascensionTierRate, MAXIMUM_PAYABLE_SPELL_LEVEL, spellPointCost } from "@/core/domain/arcana/slots";
import { bloodMagicAvailable } from "@/core/domain/vitality/blood";
import { withPlural } from "@/core/shared/language";
import { Vitality } from "@/core/domain/vitality/vitality";

/** Шаги мастера обмена. Шага «чем оплатить» здесь нет: оплата у обмена одна — хиты. */
const STEPS = ["availability", "amount", "summary"] as const;

type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  availability: "Проверьте условия",
  amount: "Сколько очков",
  summary: "Объявление и подтверждение",
};

/**
 * Объём по умолчанию: два очка — минимум, которого хватает хоть на что-то. Одно очко не покупает
 * ничего, а начинать с потолка значило бы предлагать отдать всё здоровье
 * (rules-engine.md).
 */
const DEFAULT_POINTS = 2;

/**
 * Причины, по которым обмен сейчас невозможен, — словами и с числами.
 *
 * `checkAvailability` сюда не подходит: она принимает заклинание, а обмен заклинанием не является.
 * Общими у них остаются формулировки — `ACTION_SPENT_MESSAGES` берётся оттуда же, чтобы «Действие
 * уже израсходовано» звучало одинаково в обоих мастерах.
 */
export function exchangeWarnings(character: CharacterState, economy: TurnEconomy): string[] {
  const warnings: string[] = [];

  if (!bloodMagicAvailable(character.suppression)) {
    warnings.push(
      character.suppression.firedUpon
        ? "Кровавое колдовство подавлено уроном огнём до конца следующего хода"
        : "Кровавое колдовство не действует под прямым солнечным светом",
    );
  }
  // Вне боя действие не тратится вовсе, поэтому отдельной проверки на бой здесь нет: экономия
  // хода сама отвечает «доступно», пока схватка не начата.
  if (!economy.actionAvailable) {
    warnings.push(ACTION_SPENT_MESSAGES.action);
  }

  const rate = ascensionTierRate(character.level);
  if (character.hitPoints.current < rate) {
    warnings.push(
      `${withPlural(rate, ["хит", "хита", "хитов"])} за очко,` +
        ` в наличии ${character.hitPoints.current}`,
    );
  }

  return warnings;
}

/** Уровни, которые оплачиваются указанным числом очков. Считается от суммы с уже имеющимися. */
function affordableLevels(totalPoints: number): number[] {
  const levels: number[] = [];
  for (let level = 1; level <= MAXIMUM_PAYABLE_SPELL_LEVEL; level += 1) {
    if (spellPointCost(level) <= totalPoints) levels.push(level);
  }
  return levels;
}

/** Подсказка «на что хватит»: очки живут до долгого отдыха, поэтому остаток тоже считается. */
function affordableHint(totalPoints: number): string {
  const levels = affordableLevels(totalPoints);
  const last = levels.at(-1);
  if (last === undefined) return `Станет ${totalPoints} — на заклинание пока не хватает`;
  return (
    `Станет ${withPlural(totalPoints, ["очко", "очка", "очков"])}` +
    ` — хватит на ${last} уровень`
  );
}

function AmountStep({
  character,
  points,
  maximum,
  onChange,
}: {
  character: CharacterState;
  points: number;
  maximum: number;
  onChange: (points: number) => void;
}) {
  const spent = points * ascensionTierRate(character.level);
  const { hitPoints } = character;

  return (
    <section aria-label="Сколько очков создать" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Меньше очков"
          disabled={points <= 1}
          onClick={() => onChange(points - 1)}
          className="min-h-11 w-14 rounded-xl border border-slate-200 text-xl disabled:opacity-40 dark:border-slate-800"
        >
          −
        </button>
        <p className="flex flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums leading-tight">{points}</span>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {withPlural(spent, ["хит", "хита", "хитов"])}
          </span>
        </p>
        <button
          type="button"
          aria-label="Больше очков"
          disabled={points >= maximum}
          onClick={() => onChange(points + 1)}
          className="min-h-11 w-14 rounded-xl border border-slate-200 text-xl disabled:opacity-40 dark:border-slate-800"
        >
          +
        </button>
      </div>

      <p className="text-sm">{affordableHint(character.spellPoints.remaining + points)}</p>
      {/* Максимум назван вместе с текущими: без него непонятно, почему лечение потом упрётся. */}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Хиты {hitPoints.current} → {hitPoints.current - spent}, максимум тоже{" "}
        {Vitality.of(character).maximum - spent}
      </p>
    </section>
  );
}

function SummaryStep({ character, points }: { character: CharacterState; points: number }) {
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Что сделать" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Что сделать</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {bloodExchangeInstructions(points, character).map((step) => (
            <li key={step} className="rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-800">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Объявление мастеру" className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Сказать мастеру
        </h3>
        <p className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
          {bloodExchangeAnnouncement(points, character)}
        </p>
      </section>
    </div>
  );
}

export function BloodMagicWizard({
  character,
  economy,
  onConfirm,
  onCancel,
  error,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  /** Единственное действие мастера, меняющее состояние персонажа. */
  onConfirm: (points: number, allowAnyway: boolean) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const rate = ascensionTierRate(character.level);
  // Обмен до нуля разрешён — он даёт раны, но это решение игрока.
  const maximum = Math.max(1, Math.floor(character.hitPoints.current / rate));

  const [points, setPoints] = useState(Math.min(DEFAULT_POINTS, maximum));
  const [allowAnyway, setAllowAnyway] = useState(false);
  // Первый шаг — первый видимый, как в `castDraftStore.start`: иначе предупреждение о подавлении
  // остаётся за спиной, а игрок узнаёт о нём отказом при подтверждении.
  const [step, setStep] = useState<Step>(() =>
    exchangeWarnings(character, economy).length > 0 ? "availability" : "amount",
  );

  const warnings = exchangeWarnings(character, economy);
  const steps: Step[] = warnings.length > 0 ? [...STEPS] : ["amount", "summary"];
  const current = steps.includes(step) ? step : "amount";
  const index = steps.indexOf(current);
  const isLast = current === "summary";

  const shift = (direction: 1 | -1): void => {
    const next = steps[index + direction];
    if (next !== undefined) setStep(next);
  };

  const back = index > 0 ? { onBack: () => shift(-1) } : {};

  return (
    <WizardShell
      ariaLabel="Магия крови"
      title="Магия крови"
      subtitle="Расовая особенность лунного тролля"
      badge={{ tone: "action", icon: "●", label: "Действие" }}
      stepLabel={`Шаг ${index + 1} из ${steps.length}: ${STEP_TITLES[current]}`}
      onCancel={onCancel}
      footer={
        isLast
          ? { ...back, primaryLabel: "Подтвердить", onPrimary: () => onConfirm(points, allowAnyway) }
          : {
              ...back,
              primaryLabel: "Далее",
              onPrimary: () => shift(1),
              primaryDisabled: current === "availability" && !allowAnyway,
            }
      }
    >
      {current === "availability" ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-reaction/50 bg-reaction/10 p-2 text-sm"
              >
                {warning}
              </li>
            ))}
          </ul>
          {allowAnyway ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Мастер разрешил исключение: предупреждения не мешают.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setAllowAnyway(true)}
              className="min-h-11 rounded-lg border border-reaction/60 px-3 text-sm font-medium text-reaction-strong dark:text-reaction"
            >
              Применить всё равно
            </button>
          )}
        </div>
      ) : null}

      {current === "amount" ? (
        <AmountStep
          character={character}
          points={points}
          maximum={maximum}
          onChange={setPoints}
        />
      ) : null}

      {current === "summary" ? <SummaryStep character={character} points={points} /> : null}

      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-sm">
          {error}
        </p>
      )}
    </WizardShell>
  );
}
