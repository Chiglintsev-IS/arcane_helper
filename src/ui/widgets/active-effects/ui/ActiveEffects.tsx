/**
 * Что действует прямо сейчас — одной строкой.
 *
 * Строка стоит во всех режимах, где идёт игра, в отличие от шапки ресурсов: концентрация не может
 * уйти с экрана незаметно, а эффект со сроком в раундах истекает сам.
 *
 * Названо на строке то, чего нет больше нигде: имя того, что держится, и ежеходная работа, о
 * которой иначе забудут на втором раунде. Всё остальное — уровень ячейки, начало, механика и способы
 * прерывания — стоит за раскрытием: способ прерывания один и тот же у любой концентрации, и
 * приложение само называет его числом в тот момент, когда по персонажу попали.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

"use client";

import { useState, type FormEvent } from "react";

import type { ActiveEffectView } from "@/contract/views";

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";
import { ACTIVE_SHEET_LABEL, armorClassNote } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";

/** Что держится: имя, вклад в защиту и ежеходная работа, если она есть. */
function heldNames(
  effects: readonly ActiveEffectView[],
  armorClass: number,
  concentration: ConcentrationSummary | null,
): { key: string; markRu: string; textRu: string; concentrating: boolean }[] {
  const held = effects
    .filter((effect) => !effect.isConcentration)
    .map((effect) => ({
      key: effect.id,
      markRu: "◈",
      textRu: `${effect.nameRu}${armorClassNote(effect, armorClass)}${
        effect.repeatableAction === undefined ? "" : ` ↻ ${effect.repeatableAction.label}`
      }`,
      concentrating: false,
    }));
  if (concentration === null) return held;
  return [
    { key: "concentration", markRu: "✦", textRu: concentration.nameRu, concentrating: true },
    ...held,
  ];
}

/**
 * Строка ввода статуса: без кнопки и без листа, тем же нажатием Enter, что и любая форма из
 * одного поля. Заводит статус без вклада в КД — числовую поправку вводит плитка КД в шапке.
 */
function NewStatusField({ onAdd }: { onAdd: (nameRu: string) => void }) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nameRu = value.trim();
    if (nameRu === "") return;
    onAdd(nameRu);
    setValue("");
  };

  return (
    <form onSubmit={submit}>
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-800">
        <span className="shrink-0 text-slate-500 dark:text-slate-400">Новый статус</span>
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
      </label>
    </form>
  );
}

export function ActiveEffects({
  effects,
  armorClass,
  concentration,
  onOpen,
  onAddStatus,
}: {
  /** Что висит на персонаже: посчитано ядром. */
  effects: readonly ActiveEffectView[];
  /** Действующая защита: то же число, что в шапке и на «Листе», — его считает лист. */
  armorClass: number;
  concentration: ConcentrationSummary | null;
  /** Раскрытие: подробности и снятие живут в шторке. */
  onOpen: () => void;
  /** Заводит статус без вклада в КД. */
  onAddStatus: (nameRu: string) => void;
}) {
  const held = heldNames(effects, armorClass, concentration);
  const spoken =
    held.length === 0 ? "ничего" : held.map((item) => item.textRu).join(", ");

  return (
    <section aria-label={ACTIVE_SHEET_LABEL} className="flex flex-col gap-2 text-xs">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${ACTIVE_SHEET_LABEL}: ${spoken}`}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-left dark:border-slate-800"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {held.length === 0 ? (
            <span className="text-slate-500 dark:text-slate-400">Ничего не действует</span>
          ) : (
            held.map((item) => (
              <span
                key={item.key}
                className={
                  item.concentrating
                    ? "font-semibold text-concentration-strong dark:text-concentration"
                    : "text-slate-700 dark:text-slate-300"
                }
              >
                <span aria-hidden="true">{item.markRu}</span> {item.textRu}
              </span>
            ))
          )}
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate-500">
          ›
        </span>
      </button>

      <NewStatusField onAdd={onAddStatus} />
    </section>
  );
}
