"use client";

import { useId, useState } from "react";

import type { SheetView } from "@/contract/views";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";

/**
 * Хиты правятся там, где их получают и теряют, — в «Игре» и в «Привале».
 *
 * Максимум стоит здесь же четвёртой вкладкой, а не на «Листе»: его двигают уровень, кровавое
 * колдовство и слово мастера — всё это случается за столом, а не при заполнении листа.
 */
type Kind = "damage" | "heal" | "temporary" | "maximum";

const TABS: { kind: Kind; label: string }[] = [
  { kind: "damage", label: "Урон" },
  { kind: "heal", label: "Лечение" },
  { kind: "temporary", label: "Временные" },
  { kind: "maximum", label: "Максимум" },
];

const HINTS: Record<Kind, string> = {
  damage: "Списывается сначала с временных хитов, потом с текущих.",
  heal: "Выше максимума не поднимет; максимум учитывает снижение от магии крови и от мастера.",
  temporary: "Не складываются: новое значение заменяет прежнее, если оно больше.",
  maximum: "База растёт с уровнем; снижение мастера держится, пока он его не снимет.",
};

const FIELD_LABELS: Record<Exclude<Kind, "maximum">, string> = {
  damage: "Полученный урон",
  heal: "Вылечено",
  temporary: "Временные хиты",
};

const fieldClass = "min-h-11 rounded-lg border px-3 text-base tabular-nums dark:bg-slate-900";
const quietBorder = "border-slate-200 dark:border-slate-800";

/** Незаполненное поле — несобранная просьба: владельцу нечего отправлять, и причина остаётся здесь. */
const NOT_TYPED = "Наберите число";

function NumberField({
  labelRu,
  value,
  min,
  reasonRu,
  onChange,
}: {
  labelRu: string;
  value: string;
  min: number;
  /** Почему набранное не ушло. Причина стоит у поля, в котором набирали, а не поверх экрана. */
  reasonRu: string | null;
  onChange: (value: string) => void;
}) {
  const reasonId = useId();
  return (
    // Причина стоит рядом с полем, но вне подписи: внутри неё она стала бы частью имени поля.
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{labelRu}</span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={reasonRu !== null}
          aria-describedby={reasonRu === null ? undefined : reasonId}
          className={`${fieldClass} ${reasonRu === null ? quietBorder : "border-reaction"}`}
        />
      </label>
      {reasonRu === null ? null : (
        <p
          id={reasonId}
          role="alert"
          className="text-xs font-medium text-reaction-strong dark:text-reaction"
        >
          {reasonRu}
        </p>
      )}
    </div>
  );
}

export function HitPointsSheet({
  hitPoints,
  onDamage,
  onHeal,
  onTemporary,
  onMaximum,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  hitPoints: SheetView["hitPoints"];
  onDamage: (damage: number, fire: boolean) => void;
  onHeal: (amount: number) => void;
  onTemporary: (amount: number) => void;
  onMaximum: (change: { maximumBase: number; masterReduction: number }) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind>("damage");
  const [value, setValue] = useState("");
  const [fire, setFire] = useState(false);
  const [baseText, setBaseText] = useState(String(hitPoints.maximumBase));
  const [masterText, setMasterText] = useState(String(hitPoints.masterReduction));
  const [asked, setAsked] = useState(false);
  const amount = requiredFieldNumber(value);

  const maximumBase = requiredFieldNumber(baseText);
  const masterReduction = requiredFieldNumber(masterText);
  // Незаполненное поле не спрашивают: спрашивать не о чем, пока число не набрано.
  const filled = !Number.isNaN(maximumBase) && !Number.isNaN(masterReduction);
  const preview = usePreview(
    kind === "maximum" && filled ? { kind: "health_preview", maximumBase, masterReduction } : null,
  );
  const effective = preview?.kind === "health_preview" ? preview.effectiveMaximum : null;

  /** Причина стоит у пустого поля до следующего касания: набранное отвечает за себя само. */
  const notTyped = (typed: number): string | null =>
    asked && Number.isNaN(typed) ? NOT_TYPED : null;

  const typing =
    (write: (next: string) => void) =>
    (next: string): void => {
      setAsked(false);
      write(next);
    };

  const submit = (): void => {
    setAsked(true);
    if (kind === "maximum") {
      if (filled) onMaximum({ maximumBase, masterReduction });
      return;
    }
    if (Number.isNaN(amount)) return;
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
            onClick={() => {
              setAsked(false);
              setKind(tab.kind);
            }}
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

      {kind === "maximum" ? (
        <>
          <NumberField
            labelRu="Базовый максимум"
            value={baseText}
            min={1}
            reasonRu={notTyped(maximumBase)}
            onChange={typing(setBaseText)}
          />
          <NumberField
            labelRu="Снижение мастера"
            value={masterText}
            min={0}
            reasonRu={notTyped(masterReduction)}
            onChange={typing(setMasterText)}
          />
        </>
      ) : (
        <NumberField
          labelRu={FIELD_LABELS[kind]}
          value={value}
          min={1}
          reasonRu={notTyped(amount)}
          onChange={typing(setValue)}
        />
      )}

      {error === null ? null : (
        <p
          role="alert"
          className="rounded-lg border border-reaction bg-reaction/10 p-2 text-sm text-reaction-strong dark:text-reaction"
        >
          {error}
        </p>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400">{HINTS[kind]}</p>

      {kind === "maximum" ? (
        // Снижение кровью ведёт кровавое колдовство: правка руками разошлась бы с почасовым возвратом.
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Снижение кровью — {hitPoints.bloodReduction}, возвращается по часу и здесь не правится.
          Действующий максимум станет {effective ?? "—"}.
        </p>
      ) : null}

      {kind === "damage" ? (
        // Нажимают строку целиком, а не квадрат: высоту зоны даёт метка, та же, что у кнопок.
        <label className="flex min-h-11 items-center gap-2 text-sm">
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
          onClick={submit}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
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
