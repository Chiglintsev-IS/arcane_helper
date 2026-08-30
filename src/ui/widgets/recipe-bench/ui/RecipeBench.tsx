"use client";

import { useId } from "react";

import type { ChoicesView } from "@/contract/views";
import type { PreviewOf } from "@/contract/questions";

import { durationPhrase } from "@/ui/entities/spell/lib/format";
import {
  DIRECTION_LABELS,
  RARITY_LABELS,
  TIER_LABELS,
  labelled,
  minutesRu,
} from "@/ui/entities/crafting/lib/labels";
import { withPlural } from "@/shared/language";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export type RecipeDraft = {
  readonly kinds: readonly string[];
  readonly mainProperty: string | null;
  readonly duration: string | null;
  readonly onset: string;
  readonly fullRepeats: number;
  readonly reach: string;
  readonly application: string;
  readonly resistance: string;
  readonly purification: string | null;
  readonly suppressed: readonly string[];
  readonly limitations: readonly string[];
};

const NO_PURIFICATION_RU = "Без очистки";
const NOTHING_ADDED_RU = "Ничего";
const NO_MODIFIERS_RU = "стандартная форма, поправок нет";
const PURIFICATION_LABELS: Readonly<Record<string, string>> = {
  beneficial: "оставить полезные",
  harmful: "оставить вредные",
};

function Field({
  label,
  value,
  options,
  empty,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  empty?: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-ink-quiet">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
      >
        {empty === undefined ? null : <option value="">{empty}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Matches({
  matches,
  draft,
  mainRu,
  onMain,
  onSuppress,
}: {
  matches: PreviewOf<"recipe_preview">["matches"];
  draft: RecipeDraft;
  mainRu: string | null;
  onMain: (nameRu: string) => void;
  onSuppress: (nameRu: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((match) => {
        const main = match.nameRu === mainRu;
        const off = draft.suppressed.includes(match.nameRu);
        return (
          <li key={match.nameRu} className="flex flex-col gap-1">
            <span className={`text-sm leading-tight ${main ? "font-semibold" : ""}`}>
              {match.nameRu}
            </span>
            <span className="text-xs text-ink-quiet">
              {labelled(RARITY_LABELS, match.rarity)} · ступень{" "}
              {labelled(TIER_LABELS, match.tier)} · {match.sources.join(", ")}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                aria-pressed={main}
                onClick={() => onMain(match.nameRu)}
                className={`min-h-11 flex-1 px-2 text-xs ${SURFACE_CONTROL} ${main ? "font-semibold" : ""}`}
              >
                Основной эффект
              </button>
              <button
                type="button"
                aria-pressed={off}
                onClick={() => onSuppress(match.nameRu)}
                className={`min-h-11 flex-1 px-2 text-xs ${SURFACE_CONTROL} ${off ? "font-semibold" : ""}`}
              >
                Подавить
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Tally({ difficulty }: { difficulty: PreviewOf<"recipe_preview">["difficulty"] }) {
  if (difficulty === null) return null;
  const parts = difficulty.parts
    .filter((part) => part.modifier !== 0)
    .toSorted((one, other) => other.modifier - one.modifier);

  if (parts.length === 0) {
    return <p className="text-xs text-ink-quiet">{NO_MODIFIERS_RU}</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {parts.map((part) => (
        <li key={part.nameRu} className="flex justify-between gap-2">
          <span className="min-w-0 text-ink-quiet">{part.nameRu}</span>
          <span className="shrink-0 tabular-nums">
            {part.modifier < 0 ? "−" : "+"}
            {Math.abs(part.modifier)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecipeBench({
  choices,
  preview,
  draft,
  portions,
  rolledText,
  mishapText,
  rollLabels,
  onDraft,
  onPortions,
  onRolled,
  onMishap,
  onCraft,
}: {
  choices: ChoicesView["recipeForm"];
  preview: PreviewOf<"recipe_preview"> | null;
  draft: RecipeDraft;
  portions: string;
  rolledText: string;
  mishapText: string;
  rollLabels: { check: string; mishap: string };
  onDraft: (next: RecipeDraft) => void;
  onPortions: (next: string) => void;
  onRolled: (next: string) => void;
  onMishap: (next: string) => void;
  onCraft: () => void;
}) {
  const benchId = useId();
  const refused = preview?.refusalRu !== undefined;
  const change = (patch: Partial<RecipeDraft>): void => onDraft({ ...draft, ...patch });
  const toggle = (list: readonly string[], value: string): readonly string[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <section
      aria-labelledby={benchId}
      className={`flex flex-col gap-3 p-3 ${SURFACE_GROUP}`}
    >
      <h2 id={benchId} className="text-base font-semibold leading-tight">
        Верстак
      </h2>

      {preview === null || preview.matches.length === 0 ? (
        <p className="text-sm text-ink-quiet">
          Отметьте выше от двух до четырёх видов: состав держится на свойстве, раскрытом хотя бы у
          двоих из них.
        </p>
      ) : (
        <Matches
          matches={preview.matches}
          draft={draft}
          mainRu={preview.difficulty?.mainRu ?? null}
          onMain={(nameRu) =>
            change({ mainProperty: draft.mainProperty === nameRu ? null : nameRu })
          }
          onSuppress={(nameRu) => change({ suppressed: toggle(draft.suppressed, nameRu) })}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Длительность"
          value={draft.duration ?? ""}
          empty={durationPhrase({ type: "instant" })}
          options={choices.durations}
          onChange={(next) => change({ duration: next === "" ? null : next })}
        />
        <Field
          label="Начало"
          value={draft.onset}
          options={choices.onsets}
          onChange={(next) => change({ onset: next })}
        />
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-ink-quiet">Очистка</span>
          <select
            value={draft.purification ?? ""}
            onChange={(event) =>
              change({ purification: event.target.value === "" ? null : event.target.value })
            }
            className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
          >
            <option value="">{NO_PURIFICATION_RU}</option>
            {choices.purifications.map((kept) => (
              <option key={kept} value={kept}>
                {labelled(PURIFICATION_LABELS, kept)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <Field
          label="Цели и область"
          value={draft.reach}
          options={choices.reaches}
          onChange={(next) => change({ reach: next })}
        />
        <Field
          label="Применение"
          value={draft.application}
          options={choices.applications}
          onChange={(next) => change({ application: next })}
        />
        <Field
          label="Сопротивление"
          value={draft.resistance}
          options={choices.resistances}
          onChange={(next) => change({ resistance: next })}
        />
        <Field
          label="Добавить ограничение"
          value=""
          empty={NOTHING_ADDED_RU}
          options={choices.limitations.filter((named) => !draft.limitations.includes(named))}
          onChange={(next) =>
            next === "" ? undefined : change({ limitations: toggle(draft.limitations, next) })
          }
        />
        {draft.limitations.map((limitation) => (
          <button
            key={limitation}
            type="button"
            onClick={() => change({ limitations: toggle(draft.limitations, limitation) })}
            aria-label={`Убрать ограничение: ${limitation}`}
            className={`min-h-11 px-2 text-left text-xs ${SURFACE_CONTROL}`}
          >
            {limitation}
          </button>
        ))}
      </div>

      {refused || preview?.difficulty == null ? null : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-ink-quiet">Сложность</span>
            <span className="text-2xl font-semibold tabular-nums leading-none">
              {preview.difficulty.total}
            </span>
          </div>
          <Tally difficulty={preview.difficulty} />
        </div>
      )}

      <label className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-quiet">Рецептурных порций</span>
        <input
          type="text"
          inputMode="numeric"
          value={portions}
          onChange={(event) => onPortions(event.target.value)}
          className={`min-h-11 w-20 px-2 text-right text-sm tabular-nums ${SURFACE_CONTROL}`}
        />
      </label>

      {preview?.batch == null ? null : (
        <p className="text-sm">
          <span className="font-semibold tabular-nums">
            {withPlural(preview.batch.units, ["единица", "единицы", "единиц"])}
          </span>{" "}
          состава · {minutesRu(preview.batch.minutes)} · расходники{" "}
          {preview.batch.consumablesRu.toLowerCase()}
        </p>
      )}

      {preview?.refusalRu === undefined ? null : (
        <p className="text-sm text-ink-soft">{preview.refusalRu}</p>
      )}

      {refused || preview?.check == null ? null : (
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            Проверка разработки:{" "}
            <span className="font-semibold tabular-nums">
              {`${rollLabels.check} + ${preview.check.bonus}`}
            </span>
            {preview.known ? " — рецепт записан, бросок не нужен" : ""}
          </p>
          {preview.check.unstudied.length === 0 ? null : (
            <p className="text-xs text-ink-quiet">
              Бонус мастерства не достаётся:{" "}
              {preview.check.unstudied
                .map((direction) => labelled(DIRECTION_LABELS, direction))
                .join(", ")}{" "}
              — этому направлению алхимик не обучен, и гибрид идёт по самому слабому.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-ink-quiet">{`Выпало на ${rollLabels.check}`}</span>
          <input
            type="text"
            inputMode="numeric"
            value={rolledText}
            onChange={(event) => onRolled(event.target.value)}
            className={`min-h-11 w-full px-2 text-sm tabular-nums ${SURFACE_CONTROL}`}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-ink-quiet">{`Выпало на ${rollLabels.mishap}`}</span>
          <input
            type="text"
            inputMode="numeric"
            value={mishapText}
            onChange={(event) => onMishap(event.target.value)}
            className={`min-h-11 w-full px-2 text-sm tabular-nums ${SURFACE_CONTROL}`}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onCraft}
        className={`min-h-11 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
      >
        Изготовить партию
      </button>
    </section>
  );
}
