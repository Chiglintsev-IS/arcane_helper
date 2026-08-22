/**
 * Состояние персонажа отсюда менять нечем: его меняет только `onConfirm` из кнопки подтверждения.
 *
 * Цена набранного, объявление и шаги приходят ответом ядра на вопрос: пока их считали здесь, курс
 * ступени и снижение максимума жили в двух местах сразу.
 */

"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useState } from "react";

import {
  ANNOUNCEMENT_LABEL,
  WIZARD_STEP_TITLES,
  WizardShell,
} from "@/ui/shared/ui/WizardShell";
import { BLOOD_MAGIC_LABEL } from "@/ui/shared/model/actionTraits";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import type { PreviewOf } from "@/contract/questions";
import type { BloodMagicView, SheetView } from "@/contract/views";
import { usePreview } from "@/ui/shared/model/usePreview";
import { withPlural } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

type ExchangePreview = PreviewOf<"blood_exchange_preview">;

/** Шаги мастера обмена. Шага «чем оплатить» здесь нет: оплата у обмена одна — хиты. */
const STEPS = ["availability", "amount", "summary"] as const;

type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  availability: WIZARD_STEP_TITLES.availability,
  amount: "Сколько очков",
  summary: WIZARD_STEP_TITLES.summary,
};

/** Подсказка «на что хватит»: очки живут до долгого отдыха, поэтому остаток тоже считается. */
function affordableHint(preview: ExchangePreview): string {
  if (preview.affordableSpellLevel === null) {
    return `Станет ${preview.pointsAfter} — на заклинание пока не хватает`;
  }
  return (
    `Станет ${withPlural(preview.pointsAfter, ["очко", "очка", "очков"])}` +
    ` — хватит на ${preview.affordableSpellLevel} уровень`
  );
}

function AmountStep({
  points,
  bounds,
  currentHitPoints,
  preview,
  onChange,
}: {
  points: number;
  bounds: BloodMagicView["points"];
  currentHitPoints: number;
  preview: ExchangePreview | null;
  onChange: (points: number) => void;
}) {
  return (
    <section aria-label="Сколько очков создать" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Меньше очков"
          disabled={points <= bounds.minimum}
          onClick={() => onChange(points - 1)}
          className={`min-h-11 w-14 text-xl disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          −
        </button>
        <p className="flex flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums leading-tight">{points}</span>
          <span className="text-xs text-ink-quiet">
            {preview === null
              ? ""
              : withPlural(preview.hitPointsSpent, ["хит", "хита", "хитов"])}
          </span>
        </p>
        <button
          type="button"
          aria-label="Больше очков"
          disabled={points >= bounds.maximum}
          onClick={() => onChange(points + 1)}
          className={`min-h-11 w-14 text-xl disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          +
        </button>
      </div>

      {preview === null ? null : (
        <>
          <p className="text-sm">{affordableHint(preview)}</p>
          {/* Максимум назван вместе с текущими: без него непонятно, почему лечение потом упрётся. */}
          <p className="text-xs text-ink-quiet">
            Хиты {currentHitPoints} → {preview.hitPointsAfter}, максимум тоже {preview.maximumAfter}
          </p>
        </>
      )}
    </section>
  );
}

function SummaryStep({ preview }: { preview: ExchangePreview | null }) {
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Что сделать" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-quiet">Что сделать</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {(preview?.instructions ?? []).map((step) => (
            <li key={step} className={`px-2 py-1 ${SURFACE_GROUP}`}>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label={ANNOUNCEMENT_LABEL} className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-quiet">
          Сказать мастеру
        </h3>
        <p className={`p-2 text-sm ${SURFACE_GROUP}`}>
          {preview?.announcement ?? ""}
        </p>
      </section>
    </div>
  );
}

export function BloodMagicWizard({
  bloodMagic,
  hitPoints,
  onConfirm,
  onCancel,
  error,
}: {
  bloodMagic: BloodMagicView;
  /** Хиты до обмена: их считает лист, и вторым числом здесь они не заводятся. */
  hitPoints: SheetView["hitPoints"];
  /** Единственное действие мастера, меняющее состояние персонажа. */
  onConfirm: (points: number, allowAnyway: boolean) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const warnings = bloodMagic.warningsRu;

  const [points, setPoints] = useState(bloodMagic.points.initial);
  const [allowAnyway, setAllowAnyway] = useState(false);
  // Первый шаг — первый видимый, как в `castDraftStore.start`: иначе предупреждение о подавлении
  // остаётся за спиной, а игрок узнаёт о нём отказом при подтверждении.
  const [step, setStep] = useState<Step>(() => (warnings.length > 0 ? "availability" : "amount"));

  const asked = { kind: "blood_exchange_preview" as const, points };
  const answer = usePreview(asked);
  const preview = answer?.kind === "blood_exchange_preview" ? answer : null;

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
      ariaLabel={BLOOD_MAGIC_LABEL}
      title={BLOOD_MAGIC_LABEL}
      subtitle="Расовая особенность лунного тролля"
      badge={{ tone: "action", icon: "●", label: "Действие" }}
      stepLabel={`Шаг ${index + 1} из ${steps.length}: ${STEP_TITLES[current]}`}
      onCancel={onCancel}
      footer={
        isLast
          ? {
              ...back,
              primaryLabel: BUTTON_LABELS.confirm,
              onPrimary: () => onConfirm(points, allowAnyway),
            }
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
                className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}
              >
                {warning}
              </li>
            ))}
          </ul>
          {allowAnyway ? (
            <p className="text-sm text-ink-quiet">
              Мастер разрешил исключение: предупреждения не мешают.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setAllowAnyway(true)}
              className={`min-h-11 px-3 text-sm font-medium text-reaction ${SURFACE_CONTROL}`}
            >
              Применить всё равно
            </button>
          )}
        </div>
      ) : null}

      {current === "amount" ? (
        <AmountStep
          points={points}
          bounds={bloodMagic.points}
          currentHitPoints={hitPoints.current}
          preview={preview}
          onChange={setPoints}
        />
      ) : null}

      {current === "summary" ? <SummaryStep preview={preview} /> : null}

      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}
    </WizardShell>
  );
}
