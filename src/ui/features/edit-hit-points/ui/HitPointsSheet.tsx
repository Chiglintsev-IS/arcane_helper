"use client";

import { useId, useState } from "react";

import type { SheetView } from "@/contract/views";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/**
 * Хиты правятся там, где их получают и теряют, — в «Игре» и в «Привале».
 *
 * Максимум стоит здесь же четвёртой вкладкой, а не на «Листе»: его двигают уровень, кровавое
 * колдовство и слово мастера — всё это случается за столом, а не при заполнении листа. Поэтому
 * шторка отвечает на вопрос «что случилось», и нажатие в ней подтверждает случившееся, а не
 * сохраняет запись.
 */
type Kind = "damage" | "heal" | "temporary" | "maximum";

const TABS: { kind: Kind; label: string }[] = [
  { kind: "damage", label: "Урон" },
  { kind: "heal", label: "Лечение" },
  { kind: "temporary", label: "Временные" },
  { kind: "maximum", label: "Максимум" },
];

/** Вопрос, на который отвечает шторка: правкой случившееся за столом не зовётся. */
const QUESTION = "Что случилось";

/**
 * Чем плитка зовёт эту шторку: тем же вопросом и тем же выбором, что стоят внутри. Собирается из
 * самих вкладок — приписанный руками перечень отстаёт от них молча, и обещание двери расходится с
 * тем, что за нею.
 */
export const HIT_POINTS_EVENTS = `${QUESTION}: ${TABS.map((tab) =>
  tab.label.toLowerCase(),
).join(", ")}`;

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

const fieldClass = `min-h-11 rounded-lg px-3 text-base tabular-nums ${SURFACE_CONTROL}`;
const quietBorder = SURFACE_GROUP;

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
          className={`${fieldClass} ${reasonRu === null ? quietBorder : "bg-reaction/20"}`}
        />
      </label>
      {reasonRu === null ? null : (
        <p
          id={reasonId}
          role="alert"
          className="text-xs font-medium text-reaction-strong dark:text-reaction-bright"
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
  const titleId = useId();
  const questionId = useId();
  const [kind, setKind] = useState<Kind>("damage");
  const [value, setValue] = useState("");
  const [fire, setFire] = useState(false);
  const [baseText, setBaseText] = useState(String(hitPoints.maximumBase));
  const [masterText, setMasterText] = useState(String(hitPoints.masterReduction));
  const required = useRequiredNumbers();
  const amount = requiredFieldNumber(value);

  const maximumBase = requiredFieldNumber(baseText);
  const masterReduction = requiredFieldNumber(masterText);
  // Незаполненное поле не спрашивают: спрашивать не о чем, пока число не набрано.
  const filled = required.allTyped([maximumBase, masterReduction]);
  const preview = usePreview(
    kind === "maximum" && filled ? { kind: "health_preview", maximumBase, masterReduction } : null,
  );
  const effective = preview?.kind === "health_preview" ? preview.effectiveMaximum : null;

  const submit = (): void => {
    if (kind === "maximum") {
      return required.ask([maximumBase, masterReduction], () =>
        onMaximum({ maximumBase, masterReduction }),
      );
    }
    return required.ask([amount], () => {
      if (kind === "damage") return onDamage(amount, fire);
      if (kind === "heal") return onHeal(amount);
      return onTemporary(amount);
    });
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl p-3 ${SURFACE_PANEL}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold leading-tight">
          Хиты
        </h2>
        <span id={questionId} className="shrink-0 text-sm text-slate-600 dark:text-slate-400">
          {QUESTION}?
        </span>
      </div>

      <div role="radiogroup" aria-labelledby={questionId} className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="radio"
            aria-checked={kind === tab.kind}
            onClick={required.touching(() => setKind(tab.kind))}
            className={`min-h-11 flex-1 rounded-lg px-2 text-sm ${
              kind === tab.kind
                ? "bg-action/20 font-medium text-action-strong dark:text-action-bright"
                : `text-slate-600 dark:text-slate-400 ${SURFACE_GROUP}`
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
            reasonRu={required.reasonOf(maximumBase)}
            onChange={required.touching(setBaseText)}
          />
          <NumberField
            labelRu="Снижение мастера"
            value={masterText}
            min={0}
            reasonRu={required.reasonOf(masterReduction)}
            onChange={required.touching(setMasterText)}
          />
        </>
      ) : (
        <NumberField
          labelRu={FIELD_LABELS[kind]}
          value={value}
          min={1}
          reasonRu={required.reasonOf(amount)}
          onChange={required.touching(setValue)}
        />
      )}

      {error === null ? null : (
        <p
          role="alert"
          className={`rounded-lg bg-reaction/10 p-2 text-sm text-reaction-strong dark:text-reaction-bright ${SURFACE_GROUP}`}
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
          {BUTTON_LABELS.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
