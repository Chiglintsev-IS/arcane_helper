/**
 * Ручная правка ресурсов.
 *
 * Приложение знает правила Торна, но не знает правил стола: мастер вправе вернуть реакцию посреди
 * раунда, предмет — потратить руну без заклинания, а ячейка бывает списана по ошибке. Отказ в правке
 * означал бы, что игрок ведёт второй, настоящий учёт на бумаге, — и тогда приложение не нужно.
 *
 * Всё здесь пишется в журнал и отменяется как любое другое изменение
 */

"use client";

import { useId } from "react";

import type { ResourcesView } from "@/contract/views";
import { SURFACE_CONTROL, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/** Имя дела: им зовётся и сама шторка, и плитка, которая её открывает. */
export const RESOURCES_EDIT_LABEL = "Правка ресурсов";

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={minusDisabled}
          onClick={onMinus}
          aria-label={`Потратить: ${label}`}
          className={`min-h-11 min-w-11 rounded-lg disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          <span aria-hidden="true">−</span>
        </button>
        <span className="w-12 text-center font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          disabled={plusDisabled}
          onClick={onPlus}
          aria-label={`Вернуть: ${label}`}
          className={`min-h-11 min-w-11 rounded-lg disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </span>
    </li>
  );
}

export function ResourcesSheet({
  resources,
  onSpendSlot,
  onRefundSlot,
  onAdjustRunes,
  onAdjustLastHint,
  onSunlight,
  onClose,
}: {
  resources: ResourcesView;
  onSpendSlot: (level: number) => void;
  onRefundSlot: (level: number) => void;
  onAdjustRunes: (delta: number) => void;
  /** Последняя подсказка: тратит и возвращает её игрок — повод и бросок ведёт стол. */
  onAdjustLastHint: (delta: number) => void;
  /** Признак «под прямым солнечным светом»: приложение его не знает, говорит игрок. */
  onSunlight: (under: boolean) => void;
  onClose: () => void;
}) {
  const { runes, lastHint, suppression } = resources;
  const titleId = useId();

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-base font-semibold leading-tight">
        {RESOURCES_EDIT_LABEL}
      </h2>

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Для случаев вне модели приложения: эффект предмета, решение мастера, ошибка в списании.
        Каждая правка попадает в журнал и отменяется там же — в режиме «Журнал».
      </p>

      <ul aria-label="Ячейки" className="flex flex-col gap-1">
        {resources.slots.map((slot) => (
          <Stepper
            key={slot.level}
            label={`Ячейка ${slot.level} ур.`}
            value={`${slot.remaining}/${slot.maximum}`}
            onMinus={() => onSpendSlot(slot.level)}
            onPlus={() => onRefundSlot(slot.level)}
            minusDisabled={slot.remaining <= 0}
            plusDisabled={slot.remaining >= slot.maximum}
          />
        ))}
      </ul>

      <ul aria-label="Руны" className="flex flex-col gap-1">
        <Stepper
          label="Руны"
          value={`${runes.remaining}/${runes.maximum}`}
          onMinus={() => onAdjustRunes(-1)}
          onPlus={() => onAdjustRunes(1)}
          minusDisabled={runes.remaining <= 0}
          plusDisabled={runes.remaining >= runes.maximum}
        />
      </ul>

      {/*
       Подсказка правится здесь же, где руны: другого способа её потратить у приложения нет — повод
       и бросок ведёт стол, а запас ведёт эта строка.
       */}
      <ul aria-label="Подсказка" className="flex flex-col gap-1">
        <Stepper
          label="Подсказка"
          value={`${lastHint.remaining}/${lastHint.maximum}`}
          onMinus={() => onAdjustLastHint(-1)}
          onPlus={() => onAdjustLastHint(1)}
          minusDisabled={lastHint.remaining <= 0}
          plusDisabled={lastHint.remaining >= lastHint.maximum}
        />
      </ul>

      {/*
 Солнце стоит здесь по той же причине, что и ручные правки: приложение не может узнать, где
 персонаж, — это говорит игрок. Значок ряда ресурсов только показывает признак; места под
 кнопку в 44 пикселя там нет, а ряд значков и так занимает пятую часть карточки.
 */}
      <section aria-label="Состояния" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Состояния</h3>
        <button
          type="button"
          aria-pressed={suppression.underDirectSunlight}
          onClick={() => onSunlight(!suppression.underDirectSunlight)}
          className={`min-h-11 rounded-xl px-3 text-sm ${
            suppression.underDirectSunlight
              ? "bg-reaction/20 font-medium text-reaction-strong dark:text-reaction-bright"
              : SURFACE_CONTROL
          }`}
        >
          Под прямым солнечным светом
        </button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Под солнцем не работают ни регенерация, ни магия крови, ни возврат максимума.
        </p>
      </section>

      <button
        type="button"
        onClick={onClose}
        className={`min-h-11 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
      >
        Закрыть
      </button>
    </section>
  );
}
