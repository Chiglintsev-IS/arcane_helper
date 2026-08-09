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

import type { SpellRowView } from "@/contract/views";

import { Badge } from "@/ui/shared/ui/Badge";

/**
 * Вопрос «что произошло» словами игрока, а не терминами правил.
 *
 * Порядок — по частоте за столом: попадание случается каждый раунд, провал спасброска реже всего.
 * Род события приезжает строкой заклинания, и подпись ищется по нему, а не берётся ключом словаря:
 * список слов принадлежит правилам, здесь — только вопрос, которым о них спрашивают.
 */
const TRIGGERS: readonly { kind: string; label: string }[] = [
  { kind: "attacked", label: "По мне попали" },
  { kind: "elemental_damage", label: "Получаю урон стихией" },
  { kind: "enemy_casts", label: "Враг творит заклинание" },
  { kind: "falling", label: "Кто-то падает" },
  { kind: "enemy_succeeds", label: "Враг преуспел в броске" },
  { kind: "failed_save", label: "Я провалил спасбросок" },
];

/**
 * Событие, на которое отвечает руна, а не заклинание.
 *
 * Вопрос о нём стоит всегда: «Знаки ограждения» — особенность подкласса, и в книге заклинаний её
 * нет по определению. Без исключения вопрос исчез бы вместе с единственным ответом.
 */
const RUNE_ANSWERS = "failed_save";

export function ReactionsSheet({
  rows,
  armorClass,
  runesRemaining,
  reactionAvailable,
  runeAvailable,
  onCast,
  onSpendRune,
  onClose,
}: {
  /** Строки того списка, из которого реакцию и творят: изменённое число приходит посчитанным. */
  rows: readonly SpellRowView[];
  armorClass: number;
  runesRemaining: number;
  reactionAvailable: boolean;
  /** Есть ли чем ответить на провал спасброска: руна и нерастраченная реакция. */
  runeAvailable: boolean;
  onCast: (row: SpellRowView) => void;
  onSpendRune: () => void;
  onClose: () => void;
}) {
  const answering = (kind: string): SpellRowView[] =>
    rows.filter((row) => row.card.reaction?.trigger === kind);

  const triggers = TRIGGERS.filter(
    ({ kind }) => kind === RUNE_ANSWERS || answering(kind).length > 0,
  );
  const [trigger, setTrigger] = useState<string | null>(null);
  const matching = trigger === null ? [] : answering(trigger);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Реакции"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">Что произошло?</h2>

      <div role="radiogroup" aria-label="Событие" className="flex flex-wrap gap-1">
        {triggers.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={trigger === kind}
            onClick={() => setTrigger(kind)}
            className={`min-h-11 grow rounded-lg border px-2 text-xs font-medium ${
              trigger === kind
                ? "border-reaction bg-reaction/10 text-reaction-strong dark:text-reaction"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {label}
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

      {trigger === RUNE_ANSWERS ? (
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
            Потратить руну · осталось {runesRemaining}
          </button>
        </div>
      ) : null}

      {trigger === null || trigger === RUNE_ANSWERS ? null : (
        <ul aria-label="Подходящие реакции" className="flex flex-col gap-2">
          {matching.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onCast(row)}
                className="flex w-full flex-col items-start gap-1 rounded-lg border border-slate-200 p-2 text-left dark:border-slate-800"
              >
                <span className="font-medium leading-tight">{row.nameRu}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {row.card.reaction?.textRu}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {row.armorClassIfCast === undefined ? null : (
                    <Badge tone="reaction" icon="▲">
                      КД {row.armorClassIfCast} вместо {armorClass}
                    </Badge>
                  )}
                  <Badge tone="muted" icon="◎">
                    Ячейка {row.level} ур.
                  </Badge>
                </span>
                <span className="text-xs italic text-slate-600 dark:text-slate-400">
                  «{row.card.roleplay.incantation}»
                </span>
              </button>
            </li>
          ))}
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
