/**
 * Правка хитов одним листом.
 *
 * Урон, лечение и временные хиты собраны в одном месте, потому что вопрос у игрока один: «сколько у
 * меня сейчас». Раньше урон вводился отдельной кнопкой в шапке, а вылечиться было нечем вовсе —
 * хотя за столом лечение случается каждый бой.
 *
 * Признак огня стоит у урона, а не отдельным вопросом: это одно событие, и спрашивать о нём дважды
 * значит терять время в бою (F-16).
 */

"use client";

import { useState } from "react";

type Kind = "damage" | "heal" | "temporary";

const TABS: { kind: Kind; label: string }[] = [
  { kind: "damage", label: "Урон" },
  { kind: "heal", label: "Лечение" },
  { kind: "temporary", label: "Временные" },
];

const HINTS: Record<Kind, string> = {
  damage: "Списывается сначала с временных хитов, потом с текущих.",
  heal: "Выше максимума не поднимет; максимум учитывает снижение от магии крови.",
  temporary: "Не складываются: новое значение заменяет прежнее, если оно больше.",
};

export function HitPointsSheet({
  onDamage,
  onHeal,
  onTemporary,
  onCancel,
}: {
  onDamage: (damage: number, fire: boolean) => void;
  onHeal: (amount: number) => void;
  onTemporary: (amount: number) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind>("damage");
  const [value, setValue] = useState("");
  const [fire, setFire] = useState(false);
  const amount = Number.parseInt(value, 10);
  const valid = Number.isInteger(amount) && amount > 0;

  const submit = (): void => {
    if (kind === "damage") return onDamage(amount, fire);
    if (kind === "heal") return onHeal(amount);
    return onTemporary(amount);
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      // Имя листа отличается от подписи поля: иначе доступное имя ведёт к двум элементам сразу.
      aria-label="Правка хитов"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <div role="radiogroup" aria-label="Что случилось" className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="radio"
            aria-checked={kind === tab.kind}
            onClick={() => setKind(tab.kind)}
            className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${
              kind === tab.kind
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {kind === "damage" ? "Полученный урон" : kind === "heal" ? "Вылечено" : "Временные хиты"}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      <p className="text-xs text-slate-600 dark:text-slate-400">{HINTS[kind]}</p>

      {kind === "damage" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fire}
            onChange={(event) => setFire(event.target.checked)}
            className="size-5"
          />
          <span>Урон огнём</span>
        </label>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={submit}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Записать
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Отмена
        </button>
      </div>
    </section>
  );
}
