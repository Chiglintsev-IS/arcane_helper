"use client";

import { useState } from "react";

import type { RecipeFormulaView } from "@/contract/commands";
import type { PreviewOf } from "@/contract/questions";
import type { ChoicesView, CraftingView } from "@/contract/views";

import { signed } from "@/shared/language";
import {
  NO_NUMBER_RU,
  difficultyRu,
  goldPerHourRu,
  goldTotalRu,
  minutesRu,
  partValueRu,
  perKindPortionsRu,
  portionsRu,
  priceRu,
  unitsRu,
} from "@/ui/entities/crafting/lib/labels";
import { rarityWordClass } from "@/ui/entities/crafting/ui/PropertyMark";
import { RULE_ROW, RULE_TILE } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { KindPicker, MixtureCards, SpendRows } from "@/ui/widgets/recipe-bench/ui/MixtureCards";
import { FormRows } from "@/ui/widgets/recipe-bench/ui/FormRows";

const WHAT_LABEL = "ЧТО ВАРИМ";
const DIFFICULTY_LABEL = "СЛОЖНОСТЬ";
const TIME_LABEL = "ВРЕМЯ ПАРТИИ";
const CONSUMABLES_LABEL = "РАСХОДНИКИ";
const APPARATUS_LABEL = "ОСНАЩЕНИЕ";
const MIXTURE_LABEL = "ЧТО В СОСТАВЕ";
const SPEND_LABEL = "РАСХОД ПОРЦИЙ";
const PICKER_LABEL = "ВИДЫ В СОСТАВ";
const RARITY_LABEL = "РЕДКОСТЬ ОСНОВНОГО ЭФФЕКТА";
const FORM_LABEL = "ФОРМА СОСТАВА";
const LIMITS_LABEL = "ОГРАНИЧЕНИЯ";
const BATCH_LABEL = "ПАРТИЯ";
const TALLY_LABEL = "ИЗ ЧЕГО СЛОЖИЛАСЬ СЛ";

const NOTHING_TO_BREW = "варить нечего";

const CHANGE = "сменить";

const BATCH_LOADED = "порций заложено";

const RARITY_NOTE =
  "Редкость называет мастер — от неё зависит и цена эффекта, и сложность исследования.";

const APPARATUS_NOTE =
  "Набор не даёт бонуса к броску. Он решает две вещи: какую сложность работа выдержит и сколько рецептурных порций можно заложить за один раз.";

const LESS = "−";
const MORE = "+";
const OPEN_MARK = "▾";

const SEPARATOR = " · ";

function holdsRu(hardest: number): string {
  return `набор держит до ${hardest}`;
}

function kitLimitsRu(hardest: number, batch: number): string {
  return `держит сложность до ${hardest}${SEPARATOR}до ${portionsRu(batch)} за раз`;
}

function batchOutRu(portions: number, units: number): string {
  return `по ${perKindPortionsRu(portions)} с каждого вида → выйдет ${unitsRu(units)}`;
}

function atOnceRu(batch: number): string {
  return `за раз набор держит до ${portionsRu(batch)}`;
}

function consumablesRu(batch: NonNullable<PreviewOf<"recipe_preview">["batch"]>): string {
  return `${batch.consumablesRu.toLocaleLowerCase("ru")}${SEPARATOR}${goldTotalRu(
    batch.consumablesGold,
  )}`;
}

function kitsRu(batch: NonNullable<PreviewOf<"recipe_preview">["batch"]>): string {
  return `${batch.consumableKits} × комплект${SEPARATOR}${minutesRu(
    batch.minutes,
  )}${SEPARATOR}${goldPerHourRu(batch.goldPerStartedHour)}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.625rem] tracking-[0.14em] text-accent">{children}</span>;
}

function Tile({
  labelRu,
  valueRu,
  noteRu,
  tone,
}: {
  labelRu: string;
  valueRu: string;
  noteRu: string;
  tone: "action" | "muted";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-0.5 p-2 ${SURFACE_GROUP_BARE} ${RULE_TILE[tone]}`}
    >
      <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">{labelRu}</span>
      <span className="text-[0.8125rem] font-semibold leading-tight">{valueRu}</span>
      <span className="text-[0.625rem] leading-tight text-ink-quiet">{noteRu}</span>
    </div>
  );
}

/**
 * Верстак: состав, форма и партия — и цена замысла, которую всё это складывает. Бросок и исход
 * остаются за столом, а приложение называет, во что работа обойдётся до неё.
 */
export function RecipeBench({
  crafting,
  choices,
  draft,
  preview,
  portions,
  onDraft,
  onPortions,
  onApparatus,
  onOpenKind,
}: {
  crafting: CraftingView;
  choices: ChoicesView["recipeForm"];
  draft: RecipeFormulaView;
  preview: PreviewOf<"recipe_preview"> | null;
  portions: number;
  onDraft: (next: RecipeFormulaView) => void;
  onPortions: (portions: number) => void;
  onApparatus: (apparatusRu: string) => void;
  onOpenKind: (itemId: string) => void;
}) {
  const [kitOpen, setKitOpen] = useState(false);
  const { workshop, handbook } = crafting;
  const difficulty = preview?.difficulty ?? null;
  const batch = preview?.batch ?? null;
  const overHardest = preview?.warnings.some((warning) => warning.code === "over_hardest") === true;
  /* Сколько порций берётся у каждого вида, считает ядро: самосмешивание берёт больше одной. */
  const eachPortions = preview?.spend[0]?.portions ?? portions;

  const namedRu = crafting.ingredients
    .filter((kind) => draft.kinds.includes(kind.itemId))
    .map((kind) => kind.nameRu)
    .join(SEPARATOR);

  return (
    <div className="flex flex-col gap-3.5 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.625rem] tracking-[0.14em] text-ink-quiet">{WHAT_LABEL}</span>
          <span className="text-sm font-semibold leading-tight">
            {namedRu === "" ? NOTHING_TO_BREW : namedRu}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[0.59375rem] tracking-[0.1em] text-ink-quiet">
            {DIFFICULTY_LABEL}
          </span>
          <span
            className={`text-[2.5rem] font-semibold leading-none tabular-nums ${
              difficulty === null ? "text-off" : overHardest ? "text-damage" : ""
            }`}
          >
            {difficulty === null
              ? NO_NUMBER_RU
              : difficultyRu(difficulty.total, difficulty.unpriced)}
          </span>
          <span className="text-[0.625rem] text-ink-quiet">{holdsRu(workshop.hardest)}</span>
        </span>
      </div>

      {batch === null ? null : (
        <div className="flex items-stretch gap-1">
          <Tile
            labelRu={TIME_LABEL}
            valueRu={minutesRu(batch.minutes)}
            noteRu={batchOutRu(eachPortions, batch.units)}
            tone="action"
          />
          <Tile
            labelRu={CONSUMABLES_LABEL}
            valueRu={consumablesRu(batch)}
            noteRu={kitsRu(batch)}
            tone="muted"
          />
        </div>
      )}

      <section className="flex flex-col">
        <button
          type="button"
          aria-expanded={kitOpen}
          onClick={() => setKitOpen(!kitOpen)}
          className={`flex min-h-12 items-center gap-2 p-2 text-left ${SURFACE_GROUP_BARE}`}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[0.625rem] tracking-[0.14em] text-ink-quiet">
              {APPARATUS_LABEL}
            </span>
            <span className="text-[0.8125rem] font-semibold leading-tight">
              {workshop.apparatusRu ?? handbook.apparatus.at(-1)?.nameRu}
            </span>
            <span className="text-[0.65625rem] text-ink-quiet">
              {kitLimitsRu(workshop.hardest, workshop.batch)}
            </span>
          </span>
          <span className="shrink-0 text-[0.6875rem] text-accent">
            {CHANGE} <span aria-hidden="true">{OPEN_MARK}</span>
          </span>
        </button>

        {!kitOpen ? null : (
          <div className="flex flex-col">
            <p className="py-2 text-[0.6875rem] leading-snug text-ink-quiet">{APPARATUS_NOTE}</p>
            {handbook.apparatus.map((entry) => {
              const own = entry.nameRu === (workshop.apparatusRu ?? handbook.apparatus.at(-1)?.nameRu);
              return (
                <button
                  key={entry.nameRu}
                  type="button"
                  aria-pressed={own}
                  onClick={() => {
                    setKitOpen(false);
                    onApparatus(entry.nameRu);
                  }}
                  className={`flex min-h-12 items-center justify-between gap-2 px-2 py-1.5 text-left ${RULE_ROW} ${
                    own ? SURFACE_CHOSEN : ""
                  }`}
                >
                  <span className="min-w-0 text-xs leading-tight">{entry.nameRu}</span>
                  <span className="shrink-0 text-[0.65625rem] tabular-nums text-ink-quiet">
                    {kitLimitsRu(entry.hardest, entry.batch)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{MIXTURE_LABEL}</Label>
        <MixtureCards
          matches={preview?.matches ?? []}
          draft={draft}
          mainRu={difficulty?.mainRu ?? null}
          rarities={handbook.rarities}
          onDraft={onDraft}
        />
      </section>

      {preview === null || preview.spend.length === 0 ? null : (
        <section className="flex flex-col gap-1.5">
          <Label>{SPEND_LABEL}</Label>
          <SpendRows spend={preview.spend} onOpenKind={onOpenKind} />
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <Label>{PICKER_LABEL}</Label>
        <KindPicker
          ingredients={crafting.ingredients}
          candidates={preview?.candidates ?? []}
          draft={draft}
          onDraft={onDraft}
          onOpenKind={onOpenKind}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{RARITY_LABEL}</Label>
        <div className="flex flex-wrap gap-1">
          {handbook.rarities.map((rarity) => (
            <button
              key={rarity.nameRu}
              type="button"
              aria-pressed={rarity.nameRu === draft.mainRarity}
              onClick={() => onDraft({ ...draft, mainRarity: rarity.nameRu })}
              className={`min-h-11 grow px-2 text-[0.6875rem] leading-tight ${
                rarity.nameRu === draft.mainRarity ? SURFACE_CHOSEN : SURFACE_CONTROL
              } ${rarityWordClass(rarity.nameRu)}`}
            >
              {`${rarity.nameRu} ${priceRu(rarity.main)}`}
            </button>
          ))}
        </div>
        <p className="text-[0.65625rem] leading-snug text-ink-quiet">{RARITY_NOTE}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{FORM_LABEL}</Label>
        <FormRows
          draft={draft}
          choices={choices}
          purificationCost={handbook.tariffs.purification}
          perRepeat={handbook.tariffs.perRepeat}
          onDraft={onDraft}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{LIMITS_LABEL}</Label>
        <div className="flex flex-col">
          {choices.limitations.map((limitation) => {
            const taken = draft.limitations.includes(limitation.value);
            return (
              <button
                key={limitation.value}
                type="button"
                aria-pressed={taken}
                onClick={() =>
                  onDraft({
                    ...draft,
                    limitations: taken
                      ? draft.limitations.filter((one) => one !== limitation.value)
                      : [...draft.limitations, limitation.value],
                  })
                }
                className={`flex min-h-11 items-center gap-2 px-2 py-1.5 text-left ${RULE_ROW} ${
                  taken ? SURFACE_GROUP_BARE : ""
                }`}
              >
                <span
                  className={`min-w-0 flex-1 text-[0.6875rem] leading-snug ${
                    taken ? "font-semibold text-accent" : ""
                  }`}
                >
                  {limitation.value}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ritual">
                  {signed(limitation.modifier)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{BATCH_LABEL}</Label>
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[0.6875rem] leading-snug">
              {batch === null ? atOnceRu(workshop.batch) : batchOutRu(eachPortions, batch.units)}
            </span>
            <span className="text-[0.625rem] text-ink-quiet">{atOnceRu(workshop.batch)}</span>
          </span>
          <button
            type="button"
            aria-label={`${BATCH_LOADED}: ${LESS}`}
            onClick={() => onPortions(portions === 1 ? 1 : portions - 1)}
            className={`w-11 shrink-0 text-sm ${SURFACE_CONTROL}`}
          >
            <span aria-hidden="true">{LESS}</span>
          </button>
          <span className="w-8 shrink-0 text-center text-[1.625rem] font-semibold tabular-nums leading-none">
            {portions}
          </span>
          <button
            type="button"
            aria-label={`${BATCH_LOADED}: ${MORE}`}
            onClick={() => onPortions(portions + 1)}
            className={`w-11 shrink-0 text-sm ${SURFACE_CONTROL}`}
          >
            <span aria-hidden="true">{MORE}</span>
          </button>
        </div>
      </section>

      {difficulty === null ? null : (
        <section className="flex flex-col gap-1.5">
          <Label>{TALLY_LABEL}</Label>
          <dl className="flex flex-col gap-0.5 text-xs">
            {difficulty.parts
              .filter((part) => part.modifier !== 0 || part.unpriced)
              .map((part) => (
                <div key={part.nameRu} className="flex items-baseline justify-between gap-2">
                  <dt className="min-w-0 text-ink-quiet">{part.nameRu}</dt>
                  <dd className="shrink-0 tabular-nums">{partValueRu(part)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {preview?.noticesRu.map((notice) => (
        <p key={notice} className="text-[0.6875rem] leading-snug text-ink-soft">
          {notice}
        </p>
      ))}
    </div>
  );
}
