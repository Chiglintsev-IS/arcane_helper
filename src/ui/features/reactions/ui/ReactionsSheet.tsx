/**
 * Экран реакций.
 *
 * Начинается с вопроса «что произошло», а не со списка заклинаний: реакция срабатывает в чужой ход,
 * когда игрок слушает мастера, и в этот момент он думает о событии, а название вспоминает вторым.
 *
 * Изменённое число показано готовым: у «Щита» это КД 19 вместо 14, а с «Доспехами мага» — 22 вместо
 * 17. Складывать базу, Ловкость, предметы
 * и два эффекта в уме — ровно та работа, ради избавления от которой приложение и существует.
 */

"use client";

import { useState } from "react";

import { Badge } from "@/ui/shared/ui/Badge";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { Character } from "@/core/domain/assembly/character";
import {
  availableTriggers,
  reactionsFor,
  REACTION_TRIGGER_LABEL,
  type ReactionTrigger,
} from "@/core/domain/catalog/reactions";

/** Что изменится в числах, если применить реакцию. Пусто — числа она не трогает. */
function outcome(spell: Spell, character: CharacterState): string | null {
  if (spell.contributions.length === 0) return null;
  const root = Character.of(character);
  return `КД ${root.sheetWith(spell).value("armorClass")} вместо ${root.sheet.value("armorClass")}`;
}

export function ReactionsSheet({
  spells,
  character,
  reactionAvailable,
  runeAvailable,
  onCast,
  onSpendRune,
  onClose,
}: {
  spells: readonly Spell[];
  character: CharacterState;
  reactionAvailable: boolean;
  /** Есть ли чем ответить на провал спасброска: руна и нерастраченная реакция. */
  runeAvailable: boolean;
  onCast: (spell: Spell) => void;
  onSpendRune: () => void;
  onClose: () => void;
}) {
  const triggers = availableTriggers(spells);
  const [trigger, setTrigger] = useState<ReactionTrigger | null>(null);
  const matching = trigger === null ? [] : reactionsFor(spells, trigger);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Реакции"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">Что произошло?</h2>

      <div role="radiogroup" aria-label="Событие" className="flex flex-wrap gap-1">
        {triggers.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={trigger === value}
            onClick={() => setTrigger(value)}
            className={`min-h-11 grow rounded-lg border px-2 text-xs font-medium ${
              trigger === value
                ? "border-reaction bg-reaction/10 text-reaction-strong dark:text-reaction"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {REACTION_TRIGGER_LABEL[value]}
          </button>
        ))}
      </div>

      {/*
 Израсходованная реакция не прячет варианты: игрок должен видеть, что ответ существовал, и
 может попросить исключение у мастера. Причина написана словами.
 */}
      {reactionAvailable ? null : (
        <p className="text-xs font-medium text-reaction-strong dark:text-reaction">
          Реакция
        </p>
      )}

      {trigger === "failed_save" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            «Знаки ограждения»: реакция и руна превращают провал спасброска Силы, Ловкости или
            Телосложения в успех. Заклинание для этого не тратится.
          </p>
          <button
            type="button"
            disabled={!runeAvailable}
            onClick={onSpendRune}
            className="min-h-11 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Потратить руну · осталось {character.runes.remaining}
          </button>
        </div>
      ) : null}

      {trigger === null || trigger === "failed_save" ? null : (
        <ul aria-label="Подходящие реакции" className="flex flex-col gap-2">
          {matching.map((spell) => {
            const changed = outcome(spell, character);
            return (
              <li key={spell.id}>
                <button
                  type="button"
                  onClick={() => onCast(spell)}
                  className="flex w-full flex-col items-start gap-1 rounded-lg border border-slate-200 p-2 text-left dark:border-slate-800"
                >
                  <span className="font-medium leading-tight">{spell.nameRu}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {spell.castingTime.reactionTrigger}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {changed === null ? null : (
                      <Badge tone="reaction" icon="▲">
                        {changed}
                      </Badge>
                    )}
                    <Badge tone="muted" icon="◎">
                      Ячейка {spell.level} ур.
                    </Badge>
                  </span>
                  <span className="text-xs italic text-slate-600 dark:text-slate-400">
                    «{spell.roleplay.incantation}»
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        Закрыть
      </button>
    </section>
  );
}
