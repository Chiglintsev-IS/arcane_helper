"use client";

import type { RecipeFormulaView } from "@/contract/commands";
import type { PreviewOf } from "@/contract/questions";
import type { CraftingView } from "@/contract/views";

import { signed } from "@/shared/language";
import { TIER_LABELS, directionTone, portionsRu } from "@/ui/entities/crafting/lib/labels";
import { labelled, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { RULE_ROLE_WIDE, RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

type Match = PreviewOf<"recipe_preview">["matches"][number];

const MAIN_ROLE = "основной эффект";
const KEPT_ROLE = "войдёт в состав";
const OFF_ROLE = "подавлено";

const MAKE_MAIN = "Сделать основным";
const SUPPRESS = "Подавить";
const KEEP = "Вернуть в состав";

const ENOUGH = "хватает";

const TAKEN_MARK = "✓";
const ADD_MARK = "+";

const JOINS = "совпадёт";

const NOTHING_MATCHED =
  "Совпавших свойств нет: пока нечего варить. Свойство входит в состав, если раскрыто хотя бы у двух видов.";

function shortRu(portions: number): string {
  return `не хватает ${portions}`;
}

function needRu(portions: number, inBag: number): string {
  return `нужно ${portionsRu(portions)} из ${inBag}`;
}

function sourcesRu(match: Match): string {
  return `${match.sources.join(", ")} · ступень ${labelled(TIER_LABELS, match.tier)}`;
}

/**
 * Совпавшие свойства: каждое либо ведёт замысел, либо достаётся в нагрузку, либо гасится. Цель
 * подвергается всему, что осталось, — поэтому роль стоит у каждого, а не только у главного.
 */
export function MixtureCards({
  matches,
  draft,
  mainRu,
  rarities,
  onDraft,
}: {
  matches: readonly Match[];
  draft: RecipeFormulaView;
  mainRu: string | null;
  rarities: CraftingView["handbook"]["rarities"];
  onDraft: (next: RecipeFormulaView) => void;
}) {
  if (matches.length === 0) {
    return (
      <p className={`py-1 pl-2 text-xs leading-snug text-ink-soft ${RULE_ROLE_WIDE.damage}`}>
        {NOTHING_MATCHED}
      </p>
    );
  }

  const suppressedOf = (nameRu: string) =>
    draft.suppressed.find((one) => one.nameRu === nameRu) ?? null;

  return (
    <ul className="flex flex-col gap-1.5">
      {matches.map((match) => {
        const off = suppressedOf(match.nameRu);
        const main = match.nameRu === mainRu && off === null;
        const tone = off !== null ? "muted" : main ? "roll" : "ritual";
        const roleRu = off !== null ? OFF_ROLE : main ? MAIN_ROLE : KEPT_ROLE;

        return (
          <li
            key={match.nameRu}
            className={`flex flex-col gap-1.5 p-2 ${SURFACE_GROUP_BARE} ${RULE_ROLE_WIDE[tone]}`}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold leading-tight">{match.nameRu}</span>
              <span className="text-[0.65625rem] leading-tight text-ink-quiet">
                {sourcesRu(match)}
              </span>
              <span className={`text-[0.6875rem] font-semibold ${TONE_TEXT[tone]}`}>{roleRu}</span>
            </span>

            <span className="flex gap-1">
              <button
                type="button"
                aria-pressed={main}
                disabled={off !== null}
                onClick={() => onDraft({ ...draft, mainProperty: match.nameRu })}
                className={`min-h-11 flex-1 px-2 text-[0.6875rem] ${
                  main ? SURFACE_CHOSEN : SURFACE_CONTROL
                }`}
              >
                {MAKE_MAIN}
              </button>
              <button
                type="button"
                aria-pressed={off !== null}
                onClick={() =>
                  onDraft({
                    ...draft,
                    suppressed:
                      off === null
                        ? [
                            ...draft.suppressed,
                            { nameRu: match.nameRu, rarityRu: draft.mainRarity },
                          ]
                        : draft.suppressed.filter((one) => one.nameRu !== match.nameRu),
                  })
                }
                className={`min-h-11 flex-1 px-2 text-[0.6875rem] ${
                  off === null ? SURFACE_CONTROL : SURFACE_CHOSEN
                }`}
              >
                {off === null ? SUPPRESS : KEEP}
              </button>
            </span>

            {off === null ? null : (
              <span className="flex flex-wrap gap-1">
                {rarities.map((rarity) => (
                  <button
                    key={rarity.nameRu}
                    type="button"
                    aria-pressed={rarity.nameRu === off.rarityRu}
                    onClick={() =>
                      onDraft({
                        ...draft,
                        suppressed: draft.suppressed.map((one) =>
                          one.nameRu === match.nameRu
                            ? { nameRu: one.nameRu, rarityRu: rarity.nameRu }
                            : one,
                        ),
                      })
                    }
                    className={`min-h-11 grow px-2 text-[0.6875rem] ${
                      rarity.nameRu === off.rarityRu ? SURFACE_CHOSEN : SURFACE_CONTROL
                    }`}
                  >
                    {`${rarity.nameRu} ${signed(rarity.suppression)}`}
                  </button>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Расход партии: сколько порций уйдёт у каждого вида и хватает ли их в сумке. */
export function SpendRows({ spend }: { spend: PreviewOf<"recipe_preview">["spend"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {spend.map((row) => (
        <li
          key={row.itemId}
          className={`flex items-baseline justify-between gap-2 py-1 pl-2 ${
            RULE_ROLE_WIDE[row.shortPortions === 0 ? "ritual" : "damage"]
          }`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-xs leading-tight">{row.nameRu}</span>
            <span className="text-[0.65625rem] tabular-nums text-ink-quiet">
              {needRu(row.portions, row.inBagPortions)}
            </span>
          </span>
          <span
            className={`shrink-0 text-[0.6875rem] font-semibold ${
              row.shortPortions === 0 ? TONE_TEXT.ritual : TONE_TEXT.damage
            }`}
          >
            {row.shortPortions === 0 ? ENOUGH : shortRu(row.shortPortions)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Виды в состав: карточка называет свойства вида и то, какое из них совпадёт со взятыми. Совпадения
 * считает ядро — здесь их только показывают.
 */
export function KindPicker({
  ingredients,
  candidates,
  draft,
  onDraft,
}: {
  ingredients: CraftingView["ingredients"];
  candidates: PreviewOf<"recipe_preview">["candidates"];
  draft: RecipeFormulaView;
  onDraft: (next: RecipeFormulaView) => void;
}) {
  const matchedOf = (itemId: string): readonly string[] =>
    candidates.find((one) => one.itemId === itemId)?.matchedRu ?? [];

  return (
    <ul className="flex flex-col">
      {ingredients.map((kind) => {
        const taken = draft.kinds.includes(kind.itemId);
        const matched = matchedOf(kind.itemId);

        return (
          <li key={kind.itemId} className={`flex items-center gap-2 py-1.5 ${RULE_ROW}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[0.8125rem] font-semibold leading-tight">{kind.nameRu}</span>
              {kind.properties.map((property) => (
                <span key={property.number} className="flex items-baseline gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-0.5 shrink-0 self-center ${
                      TONE_TEXT[directionTone(property.dirRu)]
                    } bg-current`}
                  />
                  <span className="shrink-0 text-[0.625rem] tabular-nums text-ink-quiet">
                    {propertyNumberRu(property.number)}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.6875rem] leading-tight">
                    {property.nameRu}
                  </span>
                  {!matched.includes(property.nameRu) ? null : (
                    <span className={`shrink-0 text-[0.625rem] ${TONE_TEXT.ritual}`}>{JOINS}</span>
                  )}
                </span>
              ))}
            </span>

            <button
              type="button"
              aria-pressed={taken}
              aria-label={`${kind.nameRu}: ${taken ? TAKEN_MARK : ADD_MARK}`}
              onClick={() =>
                onDraft({
                  ...draft,
                  kinds: taken
                    ? draft.kinds.filter((itemId) => itemId !== kind.itemId)
                    : [...draft.kinds, kind.itemId],
                })
              }
              className={`w-11 shrink-0 self-start text-base ${
                taken ? SURFACE_CHOSEN : `text-ink-quiet ${SURFACE_CONTROL}`
              }`}
            >
              <span aria-hidden="true">{taken ? TAKEN_MARK : ADD_MARK}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
