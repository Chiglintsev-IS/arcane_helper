/**
 * Шторка «Действует»: всё, что висит на персонаже, целиком.
 *
 * Отвечает на два вопроса, за которыми игрок иначе полез бы в книгу: как работает то, что он
 * держит, и чем оно прервётся. Полные правила заклинания здесь не дублируются — к ним ведёт переход
 * в его карточку там, где карточка есть.
 *
 * Компонент презентационный: текст приходит готовым, состояние меняет экран.
 */

"use client";

import { useState, type FormEvent } from "react";

import type { ActiveEffectView } from "@/contract/views";

import type { ConcentrationSummary } from "@/ui/entities/concentration/lib/summary";
import { SURFACE_CONTROL, SURFACE_PAGE, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/** Имя шторки: кнопка, которая её открывает, обещает ровно это слово. */
export const ACTIVE_SHEET_LABEL = "Действует";

/**
 * Подпись вклада эффекта в КД: отвечает на вопрос «почему КД 17, а не 14».
 *
 * Приложение не хранит цель эффекта, поэтому «Доспехи мага» на союзника поднимут КД Торна. Подпись
 * делает это видимым: неверный эффект снимается вручную.
 */
export function armorClassNote(effect: ActiveEffectView, armorClass: number): string {
  return effect.changesArmorClass ? ` · КД ${armorClass}` : "";
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
      <label className={`flex min-h-11 items-center gap-2 px-2 text-xs ${SURFACE_CONTROL}`}>
        <span className="shrink-0 text-ink-quiet">Новый статус</span>
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

function ConcentrationSection({
  summary,
  onOpenSpell,
  onTakeDamage,
  onDrop,
}: {
  summary: ConcentrationSummary;
  onOpenSpell?: (() => void) | undefined;
  onTakeDamage: () => void;
  onDrop: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold leading-tight text-concentration">
        <span aria-hidden="true">✦</span> {summary.nameRu}
      </h3>
      <p className="text-xs text-ink-quiet">
        {summary.slotLabel} · начата в {summary.startLabel} · {summary.durationLabel}
      </p>
      <p className="text-xs text-ink-quiet">Отсчёта нет — за длительностью следит игрок</p>

      <p>{summary.shortRulesRu}</p>
      <p className="text-xs text-ink-quiet">{summary.mechanicsLabel}</p>
      {summary.rulesAvailable && onOpenSpell !== undefined ? (
        <button
          type="button"
          onClick={onOpenSpell}
          className={`min-h-11 self-start px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Полные правила <span aria-hidden="true">›</span>
        </button>
      ) : null}

      <h4 className="text-xs font-semibold uppercase text-ink-quiet">Прерывается</h4>
      <ul aria-label="Чем прерывается" className="flex flex-col gap-1">
        {summary.breakers.map((breaker) => (
          <li key={breaker.textRu} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              {breaker.atDiscretion ? (
                <span className="text-ink-quiet">На усмотрение мастера: </span>
              ) : null}
              {breaker.textRu}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTakeDamage}
          className={`min-h-11 flex-1 px-3 text-sm font-semibold text-reaction ${SURFACE_CONTROL}`}
        >
          Получил урон
        </button>
        <button
          type="button"
          onClick={onDrop}
          className={`min-h-11 flex-1 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Снять концентрацию
        </button>
      </div>
    </section>
  );
}

export function ActiveEffectsSheet({
  effects,
  armorClass,
  concentration,
  onOpenSpell,
  onTakeDamage,
  onDropConcentration,
  onEndEffect,
  onAddStatus,
  onClose,
}: {
  /** Что висит на персонаже: посчитано ядром, включая то, двигает ли эффект защиту. */
  effects: readonly ActiveEffectView[];
  /** Действующая защита: то же число, что в шапке и на «Листе», — его считает лист. */
  armorClass: number;
  concentration: ConcentrationSummary | null;
  /** Переход к полным правилам. Нет перехода — нет и кнопки. */
  onOpenSpell?: (() => void) | undefined;
  onTakeDamage: () => void;
  onDropConcentration: () => void;
  onEndEffect: (effectId: string) => void;
  /** Заводит статус без вклада в КД: поле стоит здесь же, под списком того, что уже действует. */
  onAddStatus: (nameRu: string) => void;
  onClose: () => void;
}) {
  const otherEffects = effects.filter((effect) => !effect.isConcentration);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={ACTIVE_SHEET_LABEL}
      className={`fixed inset-0 z-10 flex flex-col ${SURFACE_PAGE}`}
    >
      <header className={`flex items-start justify-between gap-2 p-3 ${SURFACE_GROUP}`}>
        <h2 className="text-lg font-semibold leading-tight">{ACTIVE_SHEET_LABEL}</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-sm text-ink-quiet underline"
        >
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        {concentration === null ? null : (
          <ConcentrationSection
            summary={concentration}
            onOpenSpell={onOpenSpell}
            onTakeDamage={onTakeDamage}
            onDrop={onDropConcentration}
          />
        )}

        {otherEffects.length > 0 ? (
          <ul aria-label="Активные эффекты" className="flex flex-col gap-2">
            {otherEffects.map((effect) => (
              <li key={effect.id} className="flex items-start justify-between gap-2">
                <span>
                  <span aria-hidden="true">◈</span> {effect.nameRu}
                  {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
                  {/*
                   * Что придётся делать каждый ход, пока эффект держится. Приложение бросок не
                   * делает и таймера не ведёт — оно напоминает, что бросок нужен.
                   */}
                  {effect.repeatableAction === undefined ? null : (
                    <span className="block text-xs text-action">
                      ↻ {effect.repeatableAction.label}: {effect.repeatableAction.description}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onEndEffect(effect.id)}
                  aria-label={`Завершить: ${effect.nameRu}`}
                  className={`min-h-11 shrink-0 px-3 text-xs ${SURFACE_CONTROL}`}
                >
                  Завершить
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {concentration === null && otherEffects.length === 0 ? (
          <p className="text-ink-quiet">Сейчас ничего не действует.</p>
        ) : null}

        <NewStatusField onAdd={onAddStatus} />
      </div>
    </section>
  );
}
