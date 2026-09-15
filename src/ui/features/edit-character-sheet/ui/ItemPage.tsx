"use client";

import { useState } from "react";

import type { ChoicesView, IngredientKnowledgeView, ItemView } from "@/contract/views";
import { coinsRu, signed } from "@/shared/language";
import { neededForLine, unitRu } from "@/ui/entities/character/lib/itemMeta";
import {
  EDITABLE_ITEM_TRAITS,
  ITEM_TRAIT_MARK,
  ITEM_TRAIT_TEXT,
  itemTraitLabel,
  itemTraitsOf,
  PLAIN_ITEM,
  type ItemTrait,
} from "@/ui/entities/character/lib/itemTraits";
import { statLabel } from "@/ui/entities/character/lib/labels";
import { CoinsEditor, PRICE_TITLE } from "@/ui/entities/character/ui/CoinsEditor";
import { propertySlots } from "@/ui/entities/crafting/lib/slots";
import { markNameRu, PropertyStripes } from "@/ui/entities/crafting/ui/PropertyMark";
import { INGREDIENT_RECORD_NAMES, propertyNumberRu } from "@/ui/shared/lib/alchemyLabels";
import { BackHeader } from "@/ui/shared/ui/BackHeader";
import { NameEditor, NAME_LABEL } from "@/ui/shared/ui/NameEditor";
import { ValueRow } from "@/ui/shared/ui/ValueRow";
import { NoteList } from "@/ui/shared/ui/NoteList";
import { RemoveButton, RETURNED_IN_LOG } from "@/ui/shared/ui/RemoveButton";
import { RULE_GROUP, RULE_ROW } from "@/ui/shared/ui/rule";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

import { StatPicker } from "./StatPicker";

export type ItemPatch = {
  id: string;
  nameRu: string;
  kinds: string[];
  price?: Record<string, number>;
  bonuses: Record<string, number>;
  worksCarried?: true;
  spellcastingFocus?: true;
};

const GEAR: ItemTrait = "gear";

const TRAITS_TITLE = "Признаки";

const BONUSES_TITLE = "Прибавки";

const ALCHEMY_TITLE = "Алхимия этой вещи";

const START_ALCHEMY = "Завести в алхимии";

const START_ALCHEMY_HINT =
  "Вещь встанет в книгу алхимика нераскрытым видом: свойства раскрывают там, где для этого есть оснащение и сложности.";

const CARRIED_TITLE = "Сколько при себе";

const WORN_TITLE = "Надето";

const ADD_BONUS = "Добавить прибавку";

const WORKS_WORN = "действует надетой";

const WORKS_CARRIED = "действует при себе";

const BONUS_HINT =
  "Нулевая прибавка снимается. Всё, что зависит от обстановки или требует броска, — заметка: в числа листа она не входит, бросаете и считаете сами.";

const TO_ALCHEMY = "Открыть в алхимии →";

const DROP_ITEM = "Убрать вещь";

const DROP_ASK = "Убрать вещь?";

function dropBodyRu(nameRu: string): string {
  return `«${nameRu}» уйдёт из списка вместе со всем, что о ней записано. ${RETURNED_IN_LOG}`;
}

const DROP_HINT =
  "Убрать можно, когда от вещи не остаётся ни следа: сперва потратьте запас в сумке и снимите надетое.";

const LESS_MARK = "−";

const MORE_MARK = "+";

const TITLE_CLASS = "text-[0.625rem] uppercase tracking-wider text-ink-quiet";

const BLOCK_CLASS = "flex flex-col gap-2 px-3 py-3";

const STEP_CLASS = "w-13 shrink-0 text-lg";

function coinsOf(price: NonNullable<ItemView["price"]>): Record<string, number> {
  return Object.fromEntries(price.map((coin) => [coin.currency, coin.amount]));
}

function patchOf(item: ItemView): ItemPatch {
  return {
    id: item.id,
    nameRu: item.nameRu,
    kinds: [...item.kinds],
    ...(item.price === undefined ? {} : { price: coinsOf(item.price) }),
    bonuses: Object.fromEntries(item.bonuses.map((bonus) => [bonus.stat, bonus.value])),
    ...(item.worksCarried ? { worksCarried: true } : {}),
    ...(item.spellcastingFocus ? { spellcastingFocus: true } : {}),
  };
}

function Stepper({
  labelRu,
  count,
  countRu,
  lessLabelRu,
  moreLabelRu,
  lessOff,
  moreOff,
  accented = false,
  onAdjust,
}: {
  labelRu: string;
  count: number;
  countRu: string;
  lessLabelRu: string;
  moreLabelRu: string;
  lessOff: boolean;
  moreOff: boolean;
  accented?: boolean;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-ink-quiet">{labelRu}</span>
        <span className="text-[0.625rem] text-ink-quiet">{countRu}</span>
      </span>
      <button
        type="button"
        aria-label={lessLabelRu}
        disabled={lessOff}
        onClick={() => onAdjust(-1)}
        className={`${STEP_CLASS} disabled:text-off ${SURFACE_CONTROL}`}
      >
        <span aria-hidden="true">{LESS_MARK}</span>
      </button>
      <span
        aria-hidden="true"
        className={`w-11 shrink-0 text-center text-xl font-semibold tabular-nums ${
          accented ? "text-accent" : ""
        }`}
      >
        {count}
      </span>
      <button
        type="button"
        aria-label={moreLabelRu}
        disabled={moreOff}
        onClick={() => onAdjust(1)}
        className={`${STEP_CLASS} disabled:text-off ${SURFACE_CONTROL}`}
      >
        <span aria-hidden="true">{MORE_MARK}</span>
      </button>
    </div>
  );
}

/**
 * Карточка вещи страницей: её дописывают по ходу игры, и шторка с клавиатурой этому мешает. Всякая
 * правка вступает в силу сразу — «Сохранить» здесь нечего ждать, слова о вещи приходят по одному.
 */
export function ItemPage({
  item,
  choices,
  ingredient,
  backTitleRu,
  onBack,
  onWrite,
  onToggleWanted,
  onAdjustBagCount,
  onAdjustWornCount,
  onAddNote,
  onRewriteNote,
  onDropNote,
  onRemove,
  onOpenAlchemy,
  onStartAlchemy,
}: {
  item: ItemView;
  choices: ChoicesView;
  ingredient: IngredientKnowledgeView | undefined;
  backTitleRu: string;
  onBack: () => void;
  onWrite: (patch: ItemPatch) => void;
  onToggleWanted: () => void;
  onAdjustBagCount: (delta: number) => void;
  onAdjustWornCount: (delta: number) => void;
  onAddNote: (textRu: string) => void;
  onRewriteNote: (noteId: string, textRu: string) => void;
  onDropNote: (noteId: string) => void;
  onRemove: () => void;
  onOpenAlchemy: () => void;
  onStartAlchemy: () => void;
}) {
  const [picking, setPicking] = useState(false);
  /* Правка открывается там, где стоит значение, и ничего не пишет, пока её не подтвердят. */
  const [editing, setEditing] = useState<"name" | "price" | null>(null);
  /*
   * Строки прибавок стоят в том порядке, в каком появились на этой странице, и с места не уходят:
   * ни от первого нажатия, ни от нуля, который снимает саму прибавку. Прыгающая под пальцем строка
   * промахивается мимо пальца.
   */
  const [shown, setShown] = useState<readonly string[]>(() =>
    item.bonuses.map((bonus) => bonus.stat),
  );

  const traits = itemTraitsOf(item);
  const wearable = traits.includes(GEAR);
  const bonuses = [
    ...shown,
    ...item.bonuses.map((bonus) => bonus.stat).filter((stat) => !shown.includes(stat)),
  ].map((stat) => ({
    stat,
    value: item.bonuses.find((one) => one.stat === stat)?.value ?? 0,
  }));
  const neededForRu = neededForLine(item.neededForRu);
  const priced: Record<string, number> = Object.fromEntries(
    choices.currencies.map((currency) => [currency, 0]),
  );
  Object.assign(priced, item.price === undefined ? {} : coinsOf(item.price));

  const write = (change: Partial<ItemPatch>): void => onWrite({ ...patchOf(item), ...change });

  const toggleTrait = (trait: ItemTrait): void => {
    if (trait === "wanted") return onToggleWanted();

    const kinds = item.kinds.includes(trait)
      ? item.kinds.filter((kind) => kind !== trait)
      : [...item.kinds, trait];
    write({
      kinds,
      ...(kinds.includes(GEAR) ? {} : { worksCarried: true }),
      ...(kinds.includes(GEAR) && item.spellcastingFocus ? { spellcastingFocus: true } : {}),
    });
  };

  const writeBonus = (stat: string, value: number): void => {
    write({
      bonuses: { ...patchOf(item).bonuses, [stat]: value },
      ...(wearable && !item.worksCarried ? {} : { worksCarried: true }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BackHeader
        titleRu={backTitleRu}
        backNameRu={backTitleRu}
        onBack={onBack}
        aside={
          <span className="shrink-0 text-[0.625rem] lowercase text-ink-quiet">
            {traits.length === 0 ? PLAIN_ITEM : traits.map(itemTraitLabel).join(" · ")}
          </span>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={BLOCK_CLASS}>
          <ValueRow
            labelRu={NAME_LABEL}
            valueRu={item.nameRu}
            onOpen={() => setEditing("name")}
          />
          {editing !== "name" ? null : (
            <NameEditor
              nameRu={item.nameRu}
              onWrite={(nameRu) => {
                setEditing(null);
                write({ nameRu });
              }}
              onCancel={() => setEditing(null)}
            />
          )}
          {neededForRu === undefined ? null : (
            <p className="text-[0.65rem] leading-snug text-ink-quiet">{neededForRu}</p>
          )}
        </div>

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <span className={TITLE_CLASS}>{TRAITS_TITLE}</span>
          <div className="flex flex-wrap gap-1.5">
            {EDITABLE_ITEM_TRAITS.map((trait) => {
              const on = traits.includes(trait);
              const labelRu = itemTraitLabel(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTrait(trait)}
                  className={`min-h-11 px-3 text-xs ${
                    on
                      ? `font-medium ${ITEM_TRAIT_TEXT[trait]} ${ITEM_TRAIT_MARK[trait]} ${SURFACE_GROUP_BARE}`
                      : `text-ink-quiet ${RULE_GROUP}`
                  }`}
                >
                  {labelRu}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <Stepper
            labelRu={CARRIED_TITLE}
            countRu={unitRu(item, item.ownedCount)}
            count={item.ownedCount}
            lessLabelRu={`Потратить один из сумки: ${item.nameRu}`}
            moreLabelRu={`Добавить один в сумку: ${item.nameRu}`}
            lessOff={item.bagCount === 0}
            moreOff={false}
            onAdjust={onAdjustBagCount}
          />
          {!wearable ? null : (
            <Stepper
              labelRu={WORN_TITLE}
              countRu={`из ${item.ownedCount}`}
              count={item.wornCount}
              lessLabelRu={`Снять один: ${item.nameRu}`}
              moreLabelRu={`Надеть один: ${item.nameRu}`}
              lessOff={item.wornCount === 0}
              moreOff={item.bagCount === 0}
              accented
              onAdjust={onAdjustWornCount}
            />
          )}
        </div>

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <span className={TITLE_CLASS}>{BONUSES_TITLE}</span>
          {bonuses.map((bonus) => (
            <div key={bonus.stat} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
                {statLabel(choices.stats, bonus.stat)}
              </span>
              <button
                type="button"
                aria-label={`${statLabel(choices.stats, bonus.stat)}: меньше`}
                onClick={() => writeBonus(bonus.stat, bonus.value - 1)}
                className={`${STEP_CLASS} ${SURFACE_CONTROL}`}
              >
                <span aria-hidden="true">{LESS_MARK}</span>
              </button>
              <span className="w-10 shrink-0 text-center text-base font-semibold tabular-nums">
                {signed(bonus.value)}
              </span>
              <button
                type="button"
                aria-label={`${statLabel(choices.stats, bonus.stat)}: больше`}
                onClick={() => writeBonus(bonus.stat, bonus.value + 1)}
                className={`${STEP_CLASS} ${SURFACE_CONTROL}`}
              >
                <span aria-hidden="true">{MORE_MARK}</span>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className={`min-h-11 px-3 text-xs font-medium ${TONE_TEXT.action} ${RULE_GROUP}`}
          >
            {ADD_BONUS}
          </button>

          {bonuses.length === 0 ? null : (
            <div role="radiogroup" aria-label={BONUSES_TITLE} className="flex gap-1">
              {[
                { carried: false, labelRu: WORKS_WORN },
                { carried: true, labelRu: WORKS_CARRIED },
              ].map((choice) => (
                <button
                  key={choice.labelRu}
                  type="button"
                  role="radio"
                  aria-checked={item.worksCarried === choice.carried}
                  disabled={!wearable}
                  onClick={() => write({ ...(choice.carried ? { worksCarried: true } : {}) })}
                  className={`min-h-11 flex-1 px-2 text-[0.6875rem] ${
                    item.worksCarried === choice.carried
                      ? `${SURFACE_CHOSEN} font-medium`
                      : `text-ink-quiet ${RULE_GROUP}`
                  }`}
                >
                  {choice.labelRu}
                </button>
              ))}
            </div>
          )}

          <p className="text-[0.65rem] leading-snug text-ink-quiet">{BONUS_HINT}</p>
        </div>

        {ingredient !== undefined ? null : (
          <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
            <span className={TITLE_CLASS}>{ALCHEMY_TITLE}</span>
            <button
              type="button"
              onClick={onStartAlchemy}
              className={`min-h-11 px-3 text-xs ${TONE_TEXT.ritual} ${RULE_GROUP}`}
            >
              {START_ALCHEMY}
            </button>
            <p className="text-[0.65rem] leading-snug text-ink-quiet">{START_ALCHEMY_HINT}</p>
          </div>
        )}

        {ingredient === undefined ? null : (
          <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
            <span className={`${TITLE_CLASS} ${TONE_TEXT.ritual}`}>{ALCHEMY_TITLE}</span>
            <ul className="flex flex-col gap-1">
              {propertySlots(ingredient).map((slot) => (
                <li key={slot.number} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[0.65rem] font-semibold tabular-nums text-ink-quiet">
                    {propertyNumberRu(slot.number)}
                  </span>
                  <PropertyStripes slot={slot} height="h-3" />
                  <span className="min-w-0 flex-1 text-xs leading-snug">
                    {slot.nameRu ?? markNameRu(slot)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col">
              {[
                { labelRu: INGREDIENT_RECORD_NAMES.portion, valueRu: ingredient.portionRu },
                { labelRu: INGREDIENT_RECORD_NAMES.find, valueRu: ingredient.findDc },
                { labelRu: INGREDIENT_RECORD_NAMES.gather, valueRu: ingredient.gatherDc },
                { labelRu: INGREDIENT_RECORD_NAMES.yield, valueRu: ingredient.yieldRu },
              ]
                .filter((row) => row.valueRu !== null)
                .map((row) => (
                  <div key={row.labelRu} className={`flex justify-between gap-3 py-1.5 ${RULE_ROW}`}>
                    <dt className="text-xs text-ink-quiet">{row.labelRu}</dt>
                    <dd className="text-right text-xs leading-snug">{row.valueRu}</dd>
                  </div>
                ))}
            </dl>
            <button
              type="button"
              onClick={onOpenAlchemy}
              className={`min-h-11 px-3 text-xs ${TONE_TEXT.ritual} ${RULE_GROUP}`}
            >
              {TO_ALCHEMY}
            </button>
          </div>
        )}

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <ValueRow
            labelRu={PRICE_TITLE}
            valueRu={item.price === undefined ? null : coinsRu(item.price)}
            onOpen={() => setEditing("price")}
          />
          {editing !== "price" ? null : (
            <CoinsEditor
              titleRu={PRICE_TITLE}
              currencies={choices.currencies}
              coins={priced}
              onWrite={(price) => {
                setEditing(null);
                write({ price });
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <NoteList
            notes={item.notes}
            onAdd={onAddNote}
            onRewrite={onRewriteNote}
            onDrop={onDropNote}
          />
        </div>

        <div className={`${BLOCK_CLASS} ${RULE_ROW}`}>
          <RemoveButton
            labelRu={DROP_ITEM}
            nameRu={item.nameRu}
            askRu={DROP_ASK}
            bodyRu={dropBodyRu(item.nameRu)}
            disabled={item.ownedCount > 0}
            onConfirm={onRemove}
          />
          {item.ownedCount === 0 ? null : (
            <p className="text-[0.65rem] leading-snug text-ink-quiet">{DROP_HINT}</p>
          )}
        </div>
      </div>

      {!picking ? null : (
        <StatPicker
          stats={choices.stats}
          taken={bonuses.map((bonus) => bonus.stat)}
          onPick={(stat) => {
            setPicking(false);
            setShown([...shown, stat]);
          }}
          onPickFamily={(stats) => {
            setPicking(false);
            setShown([...shown, ...stats.filter((stat) => !shown.includes(stat))]);
          }}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  );
}
