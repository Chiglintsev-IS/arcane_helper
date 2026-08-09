/**
 * Что действует прямо сейчас: концентрация и активные эффекты.
 *
 * Блок стоит во всех четырёх режимах, в отличие от шапки ресурсов. Концентрация не может уйти с
 * экрана незаметно, а эффект со сроком в раундах истекает сам — оба видны там же, где игрок
 * находится, а не только там, где он тратит.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана. Поле нового
 * статуса — исключение: черновик набранного текста ему не передать снаружи без потери фокуса.
 */

"use client";

import { useState, type FormEvent } from "react";

import { ConcentrationCard } from "@/ui/entities/concentration/ui/ConcentrationCard";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";

/**
 * Подпись вклада эффекта в КД: отвечает на вопрос «почему КД 17, а не 14».
 *
 * Приложение не хранит цель эффекта, поэтому «Доспехи мага» на союзника поднимут КД Торна. Подпись
 * делает это видимым: неверный эффект снимается вручную.
 */
function armorClassNote(effect: ActiveEffect, armorClass: number): string {
  return effect.contributions.length === 0 ? "" : ` · КД ${armorClass}`;
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
  character,
  armorClass,
  concentration,
  onOpenConcentration,
  onEndEffect,
  onAddStatus,
}: {
  character: CharacterState;
  /** Действующая защита: то же число, что в шапке и на «Листе», — его считает лист. */
  armorClass: number;
  concentration: ConcentrationSummary | null;
  onOpenConcentration: () => void;
  onEndEffect: (effectId: string) => void;
  /** Заводит статус без вклада в КД: поле стоит прямо в блоке, рядом со списком. */
  onAddStatus: (nameRu: string) => void;
}) {
  const concentrationEffect = character.activeEffects.find((effect) => effect.isConcentration);
  const otherEffects = character.activeEffects.filter((effect) => !effect.isConcentration);

  return (
    <div className="flex flex-col gap-2">
      <ConcentrationCard
        summary={concentration}
        armorClassNote={
          concentrationEffect === undefined ? "" : armorClassNote(concentrationEffect, armorClass)
        }
        onOpen={onOpenConcentration}
      />

      {otherEffects.length > 0 ? (
        <ul aria-label="Активные эффекты" className="flex flex-col gap-0.5 text-xs">
          {otherEffects.map((effect) => (
            <li
              key={effect.id}
              className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
            >
              <span>
                <span aria-hidden="true">◈</span> {effect.nameRu}
                {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
                {/*
                 * Что придётся делать каждый ход, пока эффект держится. Приложение бросок не делает
                 * и таймера не ведёт — оно напоминает, что бросок нужен: «Мерцание» без напоминания
                 * забывают на втором раунде.
                 */}
                {effect.repeatableAction === undefined ? null : (
                  <span
                    className="block text-[0.6875rem] text-action-strong dark:text-action"
                    title={effect.repeatableAction.description}
                  >
                    ↻ {effect.repeatableAction.label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onEndEffect(effect.id)}
                aria-label={`Завершить: ${effect.nameRu}`}
                className="min-h-11 shrink-0 px-2 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <NewStatusField onAdd={onAddStatus} />
    </div>
  );
}
