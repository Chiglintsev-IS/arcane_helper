import {
  baseSpellAttackModifier,
  baseSpellSaveDc,
  preparedLimit,
} from "@/rules/abilities";
import { arcaneRecoveryBudget, spellSlotsForLevel } from "@/rules/slots";

/**
 * Каркас этапа 0: экран показывает числа, посчитанные движком правил, и то, что ещё не решено.
 *
 * Это не экран боя из F-01 — он появится на этапе 1. Задача этой страницы —
 * подтвердить, что движок правил работает в приложении, а сборка проходит целиком.
 */

const WIZARD_LEVEL = 7;
const INTELLIGENCE = 18;

const BLOCKING_QUESTIONS = [
  { id: "OQ-01", text: "Состав 4 заговоров и 18 заклинаний" },
  { id: "OQ-03", text: "Школа волшебства Торна" },
  { id: "OQ-05", text: "Модификатор спасброска Телосложения" },
] as const;

export default function DevelopmentScaffoldPage() {
  const slots = spellSlotsForLevel(WIZARD_LEVEL);
  const derived = [
    { label: "КС спасброска", value: `${baseSpellSaveDc(WIZARD_LEVEL, INTELLIGENCE)}` },
    { label: "Атака заклинанием", value: `+${baseSpellAttackModifier(WIZARD_LEVEL, INTELLIGENCE)}` },
    { label: "Лимит подготовки", value: `${preparedLimit(INTELLIGENCE, WIZARD_LEVEL)}` },
    { label: "Магическое восстановление", value: `${arcaneRecoveryBudget(WIZARD_LEVEL)}` },
  ];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Торн</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Волшебник {WIZARD_LEVEL} уровня · каркас этапа 0
        </p>
      </header>

      <section aria-labelledby="derived" className="flex flex-col gap-2">
        <h2 id="derived" className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Базовые числа
        </h2>
        <dl className="grid grid-cols-2 gap-2">
          {derived.map((entry) => (
            <div
              key={entry.label}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <dt className="text-xs text-slate-600 dark:text-slate-400">{entry.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{entry.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate-500">
          Значения по умолчанию: снаряжение и черты их сдвинут (OQ-11).
        </p>
      </section>

      <section aria-labelledby="slots" className="flex flex-col gap-2">
        <h2 id="slots" className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Ячейки заклинаний
        </h2>
        <ul className="flex gap-2">
          {Object.entries(slots).map(([level, slot]) => (
            <li
              key={level}
              className="flex-1 rounded-lg border border-slate-200 p-3 text-center dark:border-slate-800"
            >
              <span className="block text-xs text-slate-600 dark:text-slate-400">{level} ур.</span>
              <span className="text-xl font-semibold tabular-nums">
                {slot.remaining}/{slot.maximum}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="blocked" className="flex flex-col gap-2">
        <h2 id="blocked" className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Ждёт решения
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {BLOCKING_QUESTIONS.map((question) => (
            <li key={question.id} className="flex gap-2">
              <span className="font-mono text-xs text-slate-500">{question.id}</span>
              <span>{question.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
