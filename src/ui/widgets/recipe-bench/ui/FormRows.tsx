"use client";

import { useState } from "react";

import type { RecipeFormulaView } from "@/contract/commands";
import type { ChoicesView } from "@/contract/views";

import { signed } from "@/shared/language";
import { RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

type PricedChoice = ChoicesView["recipeForm"]["durations"][number];

const OPEN_MARK = "▴";
const CLOSED_MARK = "▾";

const INSTANT_RU = "мгновенный эффект";

const CHANGED_NAME = "изменено";

function Modifier({ modifier }: { modifier: number }) {
  if (modifier === 0) return null;
  return (
    <span
      className={`shrink-0 text-xs font-semibold tabular-nums ${
        modifier > 0 ? "text-reaction" : "text-ritual"
      }`}
    >
      {signed(modifier)}
    </span>
  );
}

/**
 * Строка формы: параметр, выбранное значение и его цена. Варианты раскрываются на месте — так видно,
 * от чего цена выросла, и не приходится держать в голове, что было выбрано.
 */
function Row({
  labelRu,
  valueRu,
  options,
  standard,
  open,
  onOpen,
  onPick,
}: {
  labelRu: string;
  valueRu: string | null;
  options: readonly PricedChoice[];
  standard: boolean;
  open: boolean;
  onOpen: () => void;
  onPick: (value: string | null) => void;
}) {
  const chosen = options.find((option) => option.value === valueRu);

  return (
    <div className={RULE_ROW}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="flex min-h-12 w-full items-center gap-2 py-1.5 text-left"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 ${standard ? "" : "bg-accent"}`}
        />
        <span className="w-24 shrink-0 text-[0.6875rem] leading-tight text-ink-quiet">
          {labelRu}
        </span>
        <span className="min-w-0 flex-1 text-[0.8125rem] leading-tight">
          {valueRu ?? INSTANT_RU}
        </span>
        <Modifier modifier={chosen?.modifier ?? 0} />
        <span aria-hidden="true" className="w-4 shrink-0 text-right text-xs text-ink-quiet">
          {open ? OPEN_MARK : CLOSED_MARK}
        </span>
        {standard ? null : <span className="sr-only">{CHANGED_NAME}</span>}
      </button>

      {!open ? null : (
        <div className="flex flex-col pb-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === valueRu}
              onClick={() => onPick(option.value === valueRu ? null : option.value)}
              className={`flex min-h-11 items-center gap-2 px-2 py-1.5 text-left ${
                option.value === valueRu ? SURFACE_GROUP_BARE : ""
              }`}
            >
              <span
                className={`min-w-0 flex-1 text-xs leading-snug ${
                  option.value === valueRu ? "font-semibold text-accent" : ""
                }`}
              >
                {option.value}
              </span>
              <Modifier modifier={option.modifier} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const REPEATS_LABEL = "Повторы в полную силу";
const PURIFY_LABEL = "Очистить смесь";

const ON_RU = "да";
const OFF_RU = "нет";

const LESS = "−";
const MORE = "+";

/**
 * Форма состава: чем замысел отличается от стандартной формы справочника. Стандартное значение
 * стоит без отметки, изменённое — с точкой у края, и цена каждого видна прямо в строке.
 */
export function FormRows({
  draft,
  choices,
  purificationCost,
  perRepeat,
  onDraft,
}: {
  draft: RecipeFormulaView;
  choices: ChoicesView["recipeForm"];
  purificationCost: number;
  /** Цена одного повтора: сколько их набрано, столько раз она и платится, до потолка справочника. */
  perRepeat: number;
  onDraft: (next: RecipeFormulaView) => void;
}) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const { standard } = choices;

  const rows = [
    {
      labelRu: "Длительность",
      valueRu: draft.duration,
      options: choices.durations,
      standard: draft.duration === standard.duration,
      onPick: (value: string | null) => onDraft({ ...draft, duration: value }),
    },
    {
      labelRu: "Начало действия",
      valueRu: draft.onset,
      options: choices.onsets,
      standard: draft.onset === standard.onset,
      onPick: (value: string | null) => onDraft({ ...draft, onset: value ?? standard.onset }),
    },
    {
      labelRu: "Цели и область",
      valueRu: draft.reach,
      options: choices.reaches,
      standard: draft.reach === standard.reach,
      onPick: (value: string | null) => onDraft({ ...draft, reach: value ?? standard.reach }),
    },
    {
      labelRu: "Применение",
      valueRu: draft.application,
      options: choices.applications,
      standard: draft.application === standard.application,
      onPick: (value: string | null) =>
        onDraft({ ...draft, application: value ?? standard.application }),
    },
    {
      labelRu: "Сопротивление",
      valueRu: draft.resistance,
      options: choices.resistances,
      standard: draft.resistance === standard.resistance,
      onPick: (value: string | null) =>
        onDraft({ ...draft, resistance: value ?? standard.resistance }),
    },
  ];

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <Row
          key={row.labelRu}
          labelRu={row.labelRu}
          valueRu={row.valueRu}
          options={row.options}
          standard={row.standard}
          open={openRow === row.labelRu}
          onOpen={() => setOpenRow(openRow === row.labelRu ? null : row.labelRu)}
          onPick={(value) => row.onPick(value)}
        />
      ))}

      <div className={`flex min-h-12 items-center gap-2 py-1.5 ${RULE_ROW}`}>
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 ${
            draft.fullRepeats === standard.fullRepeats ? "" : "bg-accent"
          }`}
        />
        <span className="w-24 shrink-0 text-[0.6875rem] leading-tight text-ink-quiet">
          {REPEATS_LABEL}
        </span>
        <span className="min-w-0 flex-1 text-[0.8125rem] tabular-nums">{draft.fullRepeats}</span>
        <Modifier modifier={draft.fullRepeats === 0 ? 0 : perRepeat} />
        <button
          type="button"
          aria-label={`${REPEATS_LABEL}: ${LESS}`}
          onClick={() =>
            onDraft({
              ...draft,
              fullRepeats: draft.fullRepeats === 0 ? 0 : draft.fullRepeats - 1,
            })
          }
          className={`w-11 shrink-0 text-sm ${SURFACE_CONTROL}`}
        >
          <span aria-hidden="true">{LESS}</span>
        </button>
        <button
          type="button"
          aria-label={`${REPEATS_LABEL}: ${MORE}`}
          onClick={() => onDraft({ ...draft, fullRepeats: draft.fullRepeats + 1 })}
          className={`w-11 shrink-0 text-sm ${SURFACE_CONTROL}`}
        >
          <span aria-hidden="true">{MORE}</span>
        </button>
      </div>

      <button
        type="button"
        aria-pressed={draft.purified}
        onClick={() => onDraft({ ...draft, purified: !draft.purified })}
        className={`flex min-h-12 w-full items-center gap-2 py-1.5 text-left ${RULE_ROW}`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 ${draft.purified ? "bg-accent" : ""}`}
        />
        <span className="w-24 shrink-0 text-[0.6875rem] leading-tight text-ink-quiet">
          {PURIFY_LABEL}
        </span>
        <span className="min-w-0 flex-1 text-[0.8125rem]">
          {draft.purified ? ON_RU : OFF_RU}
        </span>
        <Modifier modifier={purificationCost} />
      </button>
    </div>
  );
}
