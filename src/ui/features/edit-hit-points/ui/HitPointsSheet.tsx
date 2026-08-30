"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useId, useState } from "react";

import type { SheetView } from "@/contract/views";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP, SURFACE_GROUP_BARE, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

type Kind = "damage" | "heal" | "temporary" | "maximum";

const TABS: { kind: Kind; label: string }[] = [
  { kind: "damage", label: "Урон" },
  { kind: "heal", label: "Лечение" },
  { kind: "temporary", label: "Временные" },
  { kind: "maximum", label: "Максимум" },
];

const QUESTION = "Что случилось";

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

const fieldClass = `min-h-11 px-3 text-base tabular-nums ${SURFACE_CONTROL}`;
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
  reasonRu: string | null;
  onChange: (value: string) => void;
}) {
  const reasonId = useId();
  return (
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
          className={`${fieldClass} ${reasonRu === null ? quietBorder : `${SURFACE_GROUP_BARE} ${RULE_MARK.reaction}`}`}
        />
      </label>
      {reasonRu === null ? null : (
        <p
          id={reasonId}
          role="alert"
          className="text-xs font-medium text-reaction"
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
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold leading-tight">
          Хиты
        </h2>
        <span id={questionId} className="shrink-0 text-sm text-ink-quiet">
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
            className={`min-h-11 flex-1 px-2 text-sm ${
              kind === tab.kind
              ? `${SURFACE_CHOSEN} font-medium`
              : `text-ink-quiet ${SURFACE_GROUP_BARE}`
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
          className={`${RULE_MARK.reaction} p-2 text-sm text-reaction ${SURFACE_GROUP_BARE}`}
        >
          {error}
        </p>
      )}

      <p className="text-xs text-ink-quiet">{HINTS[kind]}</p>

      {kind === "maximum" ? (
        <p className="text-xs text-ink-quiet">
          Снижение кровью — {hitPoints.bloodReduction}, возвращается по часу и здесь не правится.
          Действующий максимум станет {effective ?? "—"}.
        </p>
      ) : null}

      {kind === "damage" ? (
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
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          {BUTTON_LABELS.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
